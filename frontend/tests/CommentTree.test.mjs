import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
// Match the CommonJS bundle so Provider and hooks share one Jotai context.
const { Provider, createStore } = require('jotai');

// Compile the real component and atoms together; only unrelated profile UI
// and authentication are stubbed. React and Jotai use the test's own instances.
const result = await build({
  stdin: {
    contents: `export { default as CommentTree } from './src/components/CommentTree';
      export * from './src/state/commentsAtom';`,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['react', 'react-dom', 'jotai'],
  define: { 'import.meta.env.VITE_BASE_URL': '"http://comments.test"' },
  plugins: [{
    name: 'profile-stubs',
    setup(builder) {
      const stubs = {
        '../hooks/useUser': 'export const useUser = () => ({ user: null });',
        './ProfileHover': 'export default function ProfileHover({ children }) { return children; }',
        './UserProfileModal': 'export default function UserProfileModal() { return null; }',
      };
      builder.onResolve({ filter: /.*/ }, ({ path }) => {
        if (Object.hasOwn(stubs, path)) return { path, namespace: 'stub' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({
        contents: stubs[path], loader: 'jsx',
      }));
    },
  }],
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  require, compiled, compiled.exports,
);
const {
  CommentTree, commentsByTranscriptAtom, getCommentsForTranscriptAtom,
  setCommentsForTranscriptAtom, addCommentToTranscriptAtom,
  removeCommentFromTranscriptAtom,
} = compiled.exports;

function comment(id, transcriptId, parentId = null, createdAt = '2026-01-01T00:00:00Z') {
  return {
    id, transcriptId, parentId, path: [], content: id,
    userId: 'author', email: 'author@example.test', displayName: 'Author',
    createdAt, updatedAt: createdAt,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount(t, { transcriptId = 'a', cached = {}, fetchComments } = {}) {
  const store = createStore();
  store.set(commentsByTranscriptAtom, cached);
  const warnings = [];
  const requests = [];
  t.mock.method(console, 'error', (...args) => warnings.push(args.join(' ')));
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    if (url.includes('/user/fetchprofile')) {
      return { ok: true, json: async () => ({ profile: { id: 'author', displayName: 'Author' } }) };
    }
    return { ok: true, json: async () => fetchComments ? fetchComments(url) : { comments: null } };
  });
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  let commits = 0;
  let tree;
  const render = (id) => React.createElement(React.StrictMode, {},
    React.createElement(Provider, { store },
      React.createElement(React.Profiler, {
        id: 'comments',
        onRender: () => {
          // Fail fast on the original infinite loop instead of hanging the runner.
          assert.ok(++commits <= 40, 'CommentTree did not settle within 40 commits');
        },
      }, React.createElement(CommentTree, { transcriptId: id })),
    ),
  );
  t.after(async () => {
    if (tree) await act(async () => tree.unmount());
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  });
  await act(async () => { tree = Renderer.create(render(transcriptId)); });
  return {
    store, requests, tree,
    text: () => JSON.stringify(tree.toJSON()),
    update: async (id) => act(async () => tree.update(render(id))),
    async assertSettled() {
      const previousCommits = commits;
      for (let i = 0; i < 3; i++) await act(async () => { await setImmediate(); });
      assert.equal(commits, previousCommits, 'renders continued with no new input');
      assert.deepEqual(warnings.filter((message) => /Maximum update depth|did not settle/.test(message)), []);
    },
  };
}

test('uncached empty comments settle before and after a delayed response', async (t) => {
  const response = deferred();
  const view = await mount(t, { fetchComments: () => response.promise });
  assert.match(view.text(), /Loading comments/);
  await view.assertSettled();
  await act(async () => {
    // An unrelated transcript update must not change the empty read's identity.
    view.store.set(setCommentsForTranscriptAtom('other'), []);
  });
  await view.assertSettled();
  await act(async () => response.resolve({ comments: null }));
  assert.match(view.text(), /No comments yet/);
  await view.update('a');
  await view.assertSettled();
  assert.equal(view.requests.filter((url) => url.endsWith('/comments/a')).length, 1);
});

test('a cached empty transcript settles after an empty-array response', async (t) => {
  const view = await mount(t, { cached: { a: [] }, fetchComments: () => ({ comments: [] }) });
  assert.match(view.text(), /No comments yet/);
  await view.update('a');
  await view.assertSettled();
});

test('populated comments keep tree order and react to additions and removals', async (t) => {
  const comments = [
    comment('old-root', 'a'),
    comment('late-reply', 'a', 'old-root', '2026-01-03T00:00:00Z'),
    comment('new-root', 'a', null, '2026-01-04T00:00:00Z'),
    comment('early-reply', 'a', 'old-root', '2026-01-02T00:00:00Z'),
  ];
  const view = await mount(t, { fetchComments: () => ({ comments }) });
  const contents = () => view.tree.root.findAllByType('p').map((node) => node.children.join(''));
  assert.deepEqual(contents(), ['new-root', 'old-root', 'early-reply', 'late-reply']);
  await act(async () => view.store.set(addCommentToTranscriptAtom('a'), comment('added', 'a')));
  assert.ok(contents().includes('added'));
  await act(async () => view.store.set(removeCommentFromTranscriptAtom('a'), 'added'));
  assert.ok(!contents().includes('added'));
  await view.assertSettled();
});

test('changing transcript retargets subscriptions without leaking comment updates', async (t) => {
  const view = await mount(t, {
    fetchComments: (url) => ({ comments: [comment(url.endsWith('/a') ? 'from-a' : 'from-b', url.endsWith('/a') ? 'a' : 'b')] }),
  });
  assert.match(view.text(), /from-a/);
  await view.update('b');
  assert.match(view.text(), /from-b/);
  assert.doesNotMatch(view.text(), /from-a/);
  await act(async () => view.store.set(setCommentsForTranscriptAtom('a'), [comment('a-updated', 'a')]));
  assert.doesNotMatch(view.text(), /a-updated/);
  await act(async () => view.store.set(setCommentsForTranscriptAtom('b'), [comment('b-updated', 'b')]));
  assert.match(view.text(), /b-updated/);
  await view.assertSettled();
  assert.equal(view.requests.filter((url) => url.includes('/comments/')).length, 2);
});

test('uncached atom reads retain their reference across unrelated cache writes', () => {
  const store = createStore();
  const selected = getCommentsForTranscriptAtom('uncached');
  const empty = store.get(selected);
  store.set(setCommentsForTranscriptAtom('other'), [comment('other-comment', 'other')]);
  assert.equal(store.get(selected), empty);
  assert.deepEqual(empty, []);
});
