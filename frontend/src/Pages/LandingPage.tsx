export default function LandingPage() {
  return (
    <div className="flex flex-col-reverse gap-6 lg:flex-row items-center justify-between mx-10 mt-32 md:mx-24">
      <div>
        <h1 className="text-5xl mb-6">
          Transform Discussions into Insightful Outcomes <br /> with AI-Powered
          Debates
        </h1>
        <p className="text-lg text-neutral-500 mb-6">
          Choose a topic, engage in a debate, and let the AI analyze arguments
          to declare a winner!
        </p>
        <button className="bg-gradient-to-r from-blue-600 to-blue-800 py-3 px-6 rounded-lg">
          Start Debating
        </button>
      </div>
      <img
        src="../../public/robot.png"
        alt=""
        className="lg:w-1/2 lg:h-1/2 rounded-xl"
      />
    </div>
  );
}
