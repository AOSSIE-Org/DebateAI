import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { X } from 'lucide-react';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  currentAvatar?: string;
}

const AvatarModal: React.FC<AvatarModalProps> = ({
  isOpen,
  onClose,
  onSelectAvatar,
  currentAvatar,
}) => {
  const [seed, setSeed] = useState(
    currentAvatar?.split('seed=')[1]?.split('&')[0] || 'Jude'
  );
  const [backgroundColor, setBackgroundColor] = useState('b6e3f4');
  const [ear, setEar] = useState('variant01');
  const [eyes, setEyes] = useState('variant01');
  const [cheek, setCheek] = useState('variant01');
  const [face, setFace] = useState('variant01');
  const [frontHair, setFrontHair] = useState('variant01');
  const [hair, setHair] = useState('long01');
  const [mouth, setMouth] = useState('variant0101');
  const [sideburn, setSideburn] = useState('variant01');
  const [skinColor, setSkinColor] = useState('89532c');
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(100);
  const [selectedAvatar, setSelectedAvatar] = useState(
    currentAvatar || `https://api.dicebear.com/9.x/big-ears/svg?seed=${seed}`
  );
  const [seedJustSelected, setSeedJustSelected] = useState(false);
  const [stylesModified, setStylesModified] = useState(false);

  const defaultValues = {
    backgroundColor: 'b6e3f4',
    ear: 'variant01',
    eyes: 'variant01',
    cheek: 'variant01',
    face: 'variant01',
    frontHair: 'variant01',
    hair: 'long01',
    mouth: 'variant0101',
    sideburn: 'variant01',
    skinColor: '89532c',
    rotate: 0,
    scale: 100,
  };

  const seeds = [
    'Felix',
    'Aneka',
    'Leah',
    'Jude',
    'Sadie',
    'Nolan',
    'Luis',
    'Robert',
    'Easton',
    'Eden',
    'Jocelyn',
    'Ryan',
    'Riley',
    'Chase',
    'George',
    'Kimberly',
    'Liam',
    'Avery',
    'Maria',
    'Eliza',
    'Brooklynn',
    'Vivian',
  ];

  const backgroundColors = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];
  const earOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
    'variant07',
    'variant08',
  ];
  const eyesOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
    'variant07',
    'variant08',
    'variant09',
    'variant10',
    'variant11',
    'variant12',
    'variant13',
    'variant14',
    'variant15',
    'variant16',
    'variant17',
    'variant18',
    'variant19',
    'variant20',
    'variant21',
    'variant22',
    'variant23',
    'variant24',
    'variant25',
    'variant26',
    'variant27',
    'variant28',
    'variant29',
    'variant30',
    'variant31',
    'variant32',
  ];
  const cheekOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
  ];
  const faceOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
    'variant07',
    'variant08',
    'variant09',
    'variant10',
  ];
  const frontHairOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
    'variant07',
    'variant08',
    'variant09',
    'variant10',
    'variant11',
    'variant12',
  ];
  const hairOptions = [
    'long01',
    'long02',
    'long03',
    'long04',
    'long05',
    'long06',
    'long07',
    'long08',
    'long09',
    'long10',
    'long11',
    'long12',
    'long13',
    'long14',
    'long15',
    'long16',
    'long17',
    'long18',
    'long19',
    'long20',
    'short01',
    'short02',
    'short03',
    'short04',
    'short05',
    'short06',
    'short07',
    'short08',
    'short09',
    'short10',
    'short11',
    'short12',
    'short13',
    'short14',
    'short15',
    'short16',
    'short17',
    'short18',
    'short19',
    'short20',
  ];
  const mouthOptions = [
    'variant0101',
    'variant0102',
    'variant0103',
    'variant0104',
    'variant0105',
    'variant0201',
    'variant0202',
    'variant0203',
    'variant0204',
    'variant0205',
    'variant0301',
    'variant0302',
    'variant0303',
    'variant0304',
    'variant0305',
    'variant0401',
    'variant0402',
    'variant0403',
    'variant0404',
    'variant0405',
    'variant0501',
    'variant0502',
    'variant0503',
    'variant0504',
    'variant0505',
    'variant0601',
    'variant0602',
    'variant0603',
    'variant0604',
    'variant0605',
    'variant0701',
    'variant0702',
    'variant0703',
    'variant0704',
    'variant0705',
    'variant0706',
    'variant0707',
    'variant0708',
  ];
  const sideburnOptions = [
    'variant01',
    'variant02',
    'variant03',
    'variant04',
    'variant05',
    'variant06',
    'variant07',
  ];
  const skinColorOptions = ['89532c', 'a66637', 'c07f50', 'da9969', 'f8b788'];

  const generateAvatarUrl = () => {
    const params = {
      seed,
      skinColor,
      rotate,
      scale,
      ...(stylesModified && {
        backgroundColor,
        ear,
        eyes,
        cheek,
        face,
        frontHair,
        hair,
        mouth,
        sideburn,
      }),
    };
    let url = `https://api.dicebear.com/9.x/big-ears/svg?seed=${params.seed}`;
    if (skinColor !== defaultValues.skinColor)
      url += `&skinColor=${params.skinColor}`;
    if (rotate !== defaultValues.rotate) url += `&rotate=${params.rotate}`;
    if (scale !== defaultValues.scale) url += `&scale=${params.scale}`;
    if (stylesModified) {
      url += `&backgroundColor=${params.backgroundColor}&ear=${params.ear}&eyes=${params.eyes}&cheek=${params.cheek}&face=${params.face}&frontHair=${params.frontHair}&hair=${params.hair}&mouth=${params.mouth}&sideburn=${params.sideburn}`;
    }
    return url;
  };

  const generateSeedOnlyUrl = (seed: string) => {
    return `https://api.dicebear.com/9.x/big-ears/svg?seed=${seed}`;
  };

  // Memoized preview URLs for Jude to prevent reloading
  const judePreviewUrls = useMemo(
    () => ({
      ear: earOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&ear=${option}`,
      })),
      eyes: eyesOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&eyes=${option}`,
      })),
      cheek: cheekOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&cheek=${option}`,
      })),
      face: faceOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&face=${option}`,
      })),
      frontHair: frontHairOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&frontHair=${option}`,
      })),
      hair: hairOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&hair=${option}`,
      })),
      mouth: mouthOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&mouth=${option}`,
      })),
      sideburn: sideburnOptions.map((option) => ({
        option,
        url: generateSeedOnlyUrl('Jude') + `&sideburn=${option}`,
      })),
    }),
    []
  );

  // Check if non-special styles are at default values
  const areNonSpecialStylesDefault = () => {
    return (
      backgroundColor === defaultValues.backgroundColor &&
      ear === defaultValues.ear &&
      eyes === defaultValues.eyes &&
      cheek === defaultValues.cheek &&
      face === defaultValues.face &&
      frontHair === defaultValues.frontHair &&
      hair === defaultValues.hair &&
      mouth === defaultValues.mouth &&
      sideburn === defaultValues.sideburn
    );
  };

  useEffect(() => {
    if (seedJustSelected || areNonSpecialStylesDefault()) {
      let url = generateSeedOnlyUrl(seed);
      if (skinColor !== defaultValues.skinColor)
        url += `&skinColor=${skinColor}`;
      if (rotate !== defaultValues.rotate) url += `&rotate=${rotate}`;
      if (scale !== defaultValues.scale) url += `&scale=${scale}`;
      setSelectedAvatar(url);
    } else {
      setSelectedAvatar(generateAvatarUrl());
    }
  }, [
    seed,
    backgroundColor,
    ear,
    eyes,
    cheek,
    face,
    frontHair,
    hair,
    mouth,
    sideburn,
    skinColor,
    rotate,
    scale,
    seedJustSelected,
  ]);

  const handleSeedSelect = (newSeed: string) => {
    setSeed(newSeed);
    setSeedJustSelected(true);
    setStylesModified(false);
    // Reset all styles to default when a new seed is selected
    setBackgroundColor(defaultValues.backgroundColor);
    setEar(defaultValues.ear);
    setEyes(defaultValues.eyes);
    setCheek(defaultValues.cheek);
    setFace(defaultValues.face);
    setFrontHair(defaultValues.frontHair);
    setHair(defaultValues.hair);
    setMouth(defaultValues.mouth);
    setSideburn(defaultValues.sideburn);
    setSkinColor(defaultValues.skinColor);
    setRotate(defaultValues.rotate);
    setScale(defaultValues.scale);
  };

  // Generic handleStyleSelect to handle both string and number state setters
  const handleStyleSelect = <T extends string | number>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T
  ) => {
    setter(value);
    // Only set stylesModified to true for non-special styles
    if (
      setter !== setRotate &&
      setter !== setScale &&
      setter !== setSkinColor
    ) {
      setStylesModified(true);
    }
    setSeedJustSelected(false); // Reset flag when any style is selected
  };

  const handleAvatarSelect = () => {
    let newAvatarUrl = generateSeedOnlyUrl(seed);
    if (skinColor !== defaultValues.skinColor)
      newAvatarUrl += `&skinColor=${skinColor}`;
    if (rotate !== defaultValues.rotate) newAvatarUrl += `&rotate=${rotate}`;
    if (scale !== defaultValues.scale) newAvatarUrl += `&scale=${scale}`;
    if (stylesModified) {
      newAvatarUrl = generateAvatarUrl();
    }
    setSelectedAvatar(newAvatarUrl);
    onSelectAvatar(newAvatarUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-background rounded-lg px-6 pb-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        {/* Fixed Preview */}
        <div className='sticky top-0 bg-background z-10 pb-4 border-b border-muted w-full'>
          <div className='flex justify-between items-center mb-4 w-full'>
            <h2 className='text-lg font-semibold'>Customize Your Avatar</h2>
            <Button variant='ghost' size='icon' onClick={onClose}>
              <X className='h-4 w-4' />
            </Button>
          </div>
          <div className='w-full flex justify-center'>
            <img
              src={selectedAvatar}
              alt='Avatar Preview'
              className='w-32 h-32 rounded-full border-2 border-primary shadow-md'
            />
          </div>
        </div>

        {/* Character Selection */}
        <div className='mt-6 ml-6'>
          <Label className='text-sm font-semibold'>Characters</Label>
          <div className='grid grid-cols-5 gap-4 mt-2'>
            {seeds.map((s) => (
              <button
                key={s}
                onClick={() => handleSeedSelect(s)}
                className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                  seed === s
                    ? 'border-primary scale-110'
                    : 'border-transparent hover:border-muted'
                }`}
                title={s}
              >
                <img
                  src={generateSeedOnlyUrl(s)}
                  alt={s}
                  className='w-full h-full rounded-full object-cover'
                />
              </button>
            ))}
          </div>
        </div>

        {/* Customization Options */}
        <div className='mt-6 ml-6'>
          {/* Background Color */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Background Color</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {backgroundColors.map((color) => (
                <button
                  key={color}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    backgroundColor === color
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  style={{ backgroundColor: `#${color}` }}
                  onClick={() => handleStyleSelect(setBackgroundColor, color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Ear Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Ear Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.ear.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setEar, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    ear === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Eyes Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Eyes Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.eyes.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setEyes, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    eyes === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cheek Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Cheek Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.cheek.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setCheek, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    cheek === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Face Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Face Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.face.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setFace, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    face === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Front Hair Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Front Hair Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.frontHair.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setFrontHair, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    frontHair === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Hair Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Hair Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.hair.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setHair, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    hair === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Mouth Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Mouth Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.mouth.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setMouth, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    mouth === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Sideburn Style */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Sideburn Style</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {judePreviewUrls.sideburn.map(({ option, url }) => (
                <button
                  key={option}
                  onClick={() => handleStyleSelect(setSideburn, option)}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    sideburn === option
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  title={option}
                >
                  <img
                    src={url}
                    alt={option}
                    className='w-full h-full rounded-full object-cover'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Skin Color */}
          <div className='mb-6'>
            <Label className='text-sm font-semibold'>Skin Color</Label>
            <div className='grid grid-cols-5 gap-4 mt-2'>
              {skinColorOptions.map((color) => (
                <button
                  key={color}
                  className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                    skinColor === color
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted'
                  }`}
                  style={{ backgroundColor: `#${color}` }}
                  onClick={() => handleStyleSelect(setSkinColor, color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {/* Rotation Slider */}
            <div>
              <Label className='text-sm font-semibold'>
                Rotation ({rotate}°)
              </Label>
              <Slider
                value={[rotate]}
                onValueChange={(value) =>
                  handleStyleSelect(setRotate, value[0])
                }
                min={0}
                max={360}
                step={1}
                className='mt-2'
              />
            </div>

            {/* Scale Slider */}
            <div>
              <Label className='text-sm font-semibold'>Scale ({scale}%)</Label>
              <Slider
                value={[scale]}
                onValueChange={(value) => handleStyleSelect(setScale, value[0])}
                min={50}
                max={200}
                step={1}
                className='mt-2'
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex gap-2 mt-6'>
          <Button className='flex-1' onClick={handleAvatarSelect}>
            Save
          </Button>
          <Button variant='secondary' className='flex-1' onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AvatarModal;
