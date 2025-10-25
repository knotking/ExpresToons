import React, { useState, useCallback } from 'react';
import type { ActiveTab, StyleType } from './types';
import { generateCartoon, editImage } from './services/geminiService';
import Spinner from './components/Spinner';
import Header from './components/Header';

const TabButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-semibold text-lg rounded-t-lg transition-colors duration-300 ${
        isActive
          ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );
};

const ImageDisplay: React.FC<{ src: string | null; alt: string; isLoading: boolean, placeholderText: string }> = ({ src, alt, isLoading, placeholderText }) => {
    return (
        <div className="w-full aspect-square bg-gray-800 rounded-lg flex items-center justify-center p-4 border-2 border-dashed border-gray-600">
            {isLoading ? <Spinner /> : src ? <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-md" /> : <span className="text-gray-500 text-center">{placeholderText}</span>}
        </div>
    );
};

const magazines = [
    'The New Yorker',
    'Punch',
    'Mad Magazine',
    'Private Eye',
    'Charlie Hebdo',
    'The Nib',
    'American Bystander',
    'Funny Times',
];

const cartoonists = [
    'Charles Addams',
    'Gary Larson',
    'Bill Watterson',
    'Roz Chast',
    'Saul Steinberg',
    'Gahan Wilson',
    'Matt Groening',
    'Quentin Blake',
    'Dr. Seuss',
    'R. Crumb',
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cartoon');

  // Cartoon state
  const [cartoonPrompt, setCartoonPrompt] = useState<string>('A cat trying to use a laptop');
  const [styleType, setStyleType] = useState<StyleType>('magazine');
  const [magazineStyle, setMagazineStyle] = useState<string>(magazines[0]);
  const [cartoonistStyle, setCartoonistStyle] = useState<string>(cartoonists[0]);
  const [customStyle, setCustomStyle] = useState<string>('');
  const [signature, setSignature] = useState<string>('AI Artist');
  const [colorOption, setColorOption] = useState<'color' | 'black_and_white'>('color');
  const [generatedCartoon, setGeneratedCartoon] = useState<string | null>(null);
  const [isGeneratingCartoon, setIsGeneratingCartoon] = useState<boolean>(false);
  const [cartoonHistory, setCartoonHistory] = useState<string[]>([]);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);

  // Image editing state
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('Add a retro, 1980s style filter');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState<boolean>(false);
  const [editHistory, setEditHistory] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  const handleStyleTypeChange = (type: StyleType) => {
    setStyleType(type);
    setCustomStyle('');
  };

  const handleMagazineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMagazineStyle(e.target.value);
    if (e.target.value !== 'Other...') {
      setCustomStyle('');
    }
  };

  const handleCartoonistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCartoonistStyle(e.target.value);
    if (e.target.value !== 'Other...') {
      setCustomStyle('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalImage(file);
      setEditedImage(null); // Clear previous edit
      setEditHistory([]); // Clear history for the new image
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCharacterImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacterImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCharacterImage = () => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    const fileInput = document.getElementById('character-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (imageUrl: string | null, title: string, text: string, filename: string) => {
    if (!imageUrl) return;

    try {
      // Convert base64 to Blob, then to File
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: text,
        });
      } else {
        setError('Sharing files is not supported on your browser.');
      }
    } catch (err) {
      // Ignore abort errors from the user closing the share sheet
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Sharing failed:', err);
        setError('Could not share the image. Please try downloading it instead.');
      }
    }
  };

  const handleGenerateCartoon = useCallback(async () => {
    const isCustom = (styleType === 'magazine' && magazineStyle === 'Other...') || (styleType === 'cartoonist' && cartoonistStyle === 'Other...');
    const styleName = isCustom ? customStyle : (styleType === 'magazine' ? magazineStyle : cartoonistStyle);

    if (!cartoonPrompt || !styleName) {
      setError('Please provide a description and a style.');
      return;
    }
    setError(null);
    setIsGeneratingCartoon(true);
    setGeneratedCartoon(null);
    try {
      const imageUrl = await generateCartoon(cartoonPrompt, styleType, styleName, signature, characterImage, colorOption);
      setGeneratedCartoon(imageUrl);
      setCartoonHistory(prev => [imageUrl, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      console.error(e);
    } finally {
      setIsGeneratingCartoon(false);
    }
  }, [cartoonPrompt, styleType, magazineStyle, cartoonistStyle, customStyle, signature, characterImage, colorOption]);
  
  const handleEditImage = useCallback(async () => {
    if (!originalImage || !editPrompt) {
      setError('Please upload an image and provide an edit instruction.');
      return;
    }
    setError(null);
    setIsEditingImage(true);
    setEditedImage(null);
    try {
      const imageUrl = await editImage(originalImage, editPrompt);
      setEditedImage(imageUrl);
      setEditHistory(prev => [imageUrl, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      console.error(e);
    } finally {
      setIsEditingImage(false);
    }
  }, [originalImage, editPrompt]);

  const renderCartoonGenerator = () => {
    const isCustomStyle = (styleType === 'magazine' && magazineStyle === 'Other...') || (styleType === 'cartoonist' && cartoonistStyle === 'Other...');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Cartoon Description</label>
                    <textarea value={cartoonPrompt} onChange={(e) => setCartoonPrompt(e.target.value)} rows={4} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5" placeholder="e.g., A programmer arguing with a rubber duck"></textarea>
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Bring Your Own Character (Optional)</label>
                    <div className="flex items-center gap-4">
                        <div className="flex-grow">
                          <input id="character-upload" type="file" accept="image/*" onChange={handleCharacterImageUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
                        </div>
                        {characterImagePreview && (
                            <div className="relative flex-shrink-0">
                                <img src={characterImagePreview} alt="Character preview" className="w-16 h-16 object-cover rounded-md" />
                                <button onClick={handleRemoveCharacterImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0 w-6 h-6 flex items-center justify-center text-sm font-bold leading-none hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500">
                                    &times;
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-300">Choose Style By</label>
                    <div className="flex items-center space-x-6">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" name="styleType" value="magazine" checked={styleType === 'magazine'} onChange={() => handleStyleTypeChange('magazine')} className="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500" />
                            <span className="text-gray-300">Magazine</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" name="styleType" value="cartoonist" checked={styleType === 'cartoonist'} onChange={() => handleStyleTypeChange('cartoonist')} className="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500" />
                            <span className="text-gray-300">Cartoonist</span>
                        </label>
                    </div>
                    {styleType === 'magazine' && (
                        <div>
                            <select value={magazineStyle} onChange={handleMagazineChange} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5">
                                {magazines.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="Other...">Other...</option>
                            </select>
                        </div>
                    )}
                    {styleType === 'cartoonist' && (
                        <div>
                            <select value={cartoonistStyle} onChange={handleCartoonistChange} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5">
                                {cartoonists.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="Other...">Other...</option>
                            </select>
                        </div>
                    )}
                    {isCustomStyle && (
                        <div>
                            <input type="text" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5 mt-2" placeholder="Enter custom style..." />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Signature (Optional)</label>
                    <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5" placeholder="e.g., Your Name"/>
                </div>

                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Color Style</label>
                    <div className="flex items-center space-x-6">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="colorOption" 
                                value="color" 
                                checked={colorOption === 'color'} 
                                onChange={() => setColorOption('color')} 
                                className="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500" 
                            />
                            <span className="text-gray-300">Color</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="colorOption" 
                                value="black_and_white" 
                                checked={colorOption === 'black_and_white'} 
                                onChange={() => setColorOption('black_and_white')} 
                                className="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500" 
                            />
                            <span className="text-gray-300">Black & White</span>
                        </label>
                    </div>
                </div>

                <button onClick={handleGenerateCartoon} disabled={isGeneratingCartoon} className="w-full text-white bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:outline-none focus:ring-purple-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-gray-500 disabled:cursor-not-allowed">
                    {isGeneratingCartoon ? 'Generating...' : 'Generate Cartoon'}
                </button>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-300">Generated Cartoon</h3>
                <ImageDisplay src={generatedCartoon} alt="Generated Cartoon" isLoading={isGeneratingCartoon} placeholderText="Your generated cartoon will appear here." />
                {generatedCartoon && !isGeneratingCartoon && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => handleDownload(generatedCartoon, 'cartoon.png')}
                      className="w-full flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Download
                    </button>
                    {navigator.share && (
                       <button
                        onClick={() => handleShare(generatedCartoon, 'My ExpressToon Cartoon', 'Check out this cartoon I generated with ExpressToons!', 'cartoon.png')}
                        className="w-full flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        Share
                      </button>
                    )}
                  </div>
                )}
                {cartoonHistory.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Your Creations</h3>
                    <div className="flex overflow-x-auto gap-4 p-2 bg-gray-900/50 rounded-lg">
                      {cartoonHistory.map((imgSrc) => (
                        <img
                          key={imgSrc}
                          src={imgSrc}
                          alt="Previously generated cartoon"
                          className="w-24 h-24 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-purple-400 transition-all duration-200"
                          onClick={() => setGeneratedCartoon(imgSrc)}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
  };

  const renderImageEditor = () => (
    <div className="space-y-8">
        <div>
            <label className="block mb-2 text-lg font-medium text-gray-300">Upload Image to Edit</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-300">Original Image</h3>
                <ImageDisplay src={originalImagePreview} alt="Original user upload" isLoading={false} placeholderText="Upload an image to see a preview."/>
            </div>
            <div>
                 <h3 className="text-lg font-semibold mb-2 text-gray-300">Edited Image</h3>
                 <ImageDisplay src={editedImage} alt="AI Edited result" isLoading={isEditingImage} placeholderText="Your edited image will appear here." />
                 {editedImage && !isEditingImage && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => handleDownload(editedImage, 'edited-image.png')}
                        className="w-full flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download
                      </button>
                      {navigator.share && (
                        <button
                          onClick={() => handleShare(editedImage, 'My Edited Image', 'Check out this image I edited with ExpressToons!', 'edited-image.png')}
                          className="w-full flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                          </svg>
                          Share
                        </button>
                      )}
                    </div>
                  )}
                 {editHistory.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Edit History</h3>
                    <div className="flex overflow-x-auto gap-4 p-2 bg-gray-900/50 rounded-lg">
                      {editHistory.map((imgSrc) => (
                        <img
                          key={imgSrc}
                          src={imgSrc}
                          alt="Previously edited image"
                          className="w-24 h-24 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-purple-400 transition-all duration-200"
                          onClick={() => setEditedImage(imgSrc)}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
        </div>
        {originalImage && (
            <div className="space-y-4">
                 <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Edit Instruction</label>
                    <input type="text" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5" placeholder="e.g., Make it black and white" />
                </div>
                <button onClick={handleEditImage} disabled={isEditingImage} className="w-full text-white bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:outline-none focus:ring-purple-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-gray-500 disabled:cursor-not-allowed">
                    {isEditingImage ? 'Editing...' : 'Apply Edit'}
                </button>
            </div>
        )}
    </div>
  );


  return (
    <div className="min-h-screen bg-gray-900 font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-6">
          <TabButton label="Cartoon Generator" isActive={activeTab === 'cartoon'} onClick={() => setActiveTab('cartoon')} />
          <TabButton label="Image Editor" isActive={activeTab === 'edit'} onClick={() => setActiveTab('edit')} />
        </div>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
        </div>}
        
        <div className="bg-gray-800 p-6 md:p-8 rounded-b-lg rounded-r-lg shadow-2xl">
            {activeTab === 'cartoon' ? renderCartoonGenerator() : renderImageEditor()}
        </div>
      </main>
      <footer className="text-center p-4 mt-8 text-gray-500 text-sm">
        <p>Powered by Gemini. Created for illustrative purposes.</p>
      </footer>
    </div>
  );
};

export default App;