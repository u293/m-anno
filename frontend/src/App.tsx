import React, {ReactNode, useEffect, useRef, useState} from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Autocomplete from 'react-autocomplete';
import './App.css';

const ContextMenu= ({x, y, onClose, onAnnotate}) => {
    return (
        <div style={{
            position: 'fixed',
            top: y,
            left: x,
            background: 'white',
            border: '1px solid black',
            padding: '5px',
            zIndex: 1000
        }}>
            <div onClick={() => {
            }}>
                Add
            </div>
        </div>
    );
};


const Verse= ({verse}) => {
    const [selectedText, setSelectedText] = useState<string>('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    const handleTextSelect = () => {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
            setSelectedText(selection.toString());
        } else {
            setSelectedText('');
            setContextMenu(null);
        }
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        if (selectedText) {
            setContextMenu({x: event.clientX, y: event.clientY});
        }
    };

    const handleAddAnnotation = (annotation) => {
        console.log('Annotation added for:', selectedText, 'Type:');
        setContextMenu(null);
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (<div className="alert alert-info" role="alert" ref={containerRef} onMouseUp={handleTextSelect}
                 onContextMenu={handleContextMenu}>
        <h4 className="alert-heading">{verse.OrignalArabicText}</h4>
        {/*<p>{this.props.verse.EnglishTranslation}</p>*/}
        {contextMenu && (
            <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={handleCloseContextMenu}
                onAnnotate={handleAddAnnotation}
            />
        )}
    </div>);
};

const App= () => {
    const [query, setQuery] = useState<string>('');
    const [selectedVerse, setSelectedVerse] = useState(null);
    const [autocompleteResults, setAutocompleteResults] = useState([]);
    const [annotationResults, setAnnotationResults] = useState([]);

    const handleSelectVerse = async (item) => {
        setSelectedVerse(item);
        setQuery(item.ArabicText);
        setAutocompleteResults([]); // Clear the autocomplete results
        const response = await axios.get(`http://localhost:5000/get_annotations?query=${item.AyahKey}`);
        setAnnotationResults(response.data.map((item) => item));
    };

    const handleQueryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (value.length >= 3) {
            const response = await axios.get(`http://localhost:5000/search_verse?query=${value}`);
            setAutocompleteResults(response.data.map((item) => item));
        } else {
            setAutocompleteResults([]);
        }
    };


    return (
        <div className="container text-center mt-5">
            <h1 className={`project-name ${annotationResults.length > 0 ? 'small' : 'large'}`}>
                Quranic Annotations Search
            </h1>
            <form className="mb-4">
                <div className="input-group">
                    <Autocomplete
                        items={autocompleteResults}
                        getItemValue={(item) => item.ArabicText}
                        renderMenu={(items, value) => (
                            <div
                                className="autocomplete-menu">{value.length > 0 && items.length === 0 ? `No matches for ${value}` : (items.length > 10 ? items.slice(0, 10) : items)}</div>
                        )}
                        renderItem={(item, isHighlighted) =>
                            <div className="autocomplete-item" key={item.AyahKey}
                                 style={{background: isHighlighted ? 'lightgray' : 'white'}}>
                                {`${item.AyahKey}\t${item.ArabicText}`}
                            </div>
                        }
                        value={query}
                        onChange={handleQueryChange}
                        onSelect={(value, item) => handleSelectVerse(item)}
                        inputProps={{className: 'form-control', placeholder: 'Search for Quranic verses'}}
                        wrapperProps={{style: {width: '100%'}}}
                    />
                </div>
            </form>
            {selectedVerse && (
                <Verse verse={selectedVerse}/>
            )}
            <div className="accordion" id="resultsAccordion" style={{paddingBottom: '10rem'}}>
                {annotationResults.map((result) => {
                    return (<div key={result.manuscript_id} className="accordion-item">
                            <h2 className={`accordion-header`} id={`heading${result.manuscript_id}`}>
                                <button
                                    className={`accordion-button ${result.annotations.length === 0 ? 'collapsed' : ''}`}
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#collapse${result.manuscript_id}`}
                                    aria-expanded="false"
                                    aria-controls={`collapse${result.manuscript_id}`}
                                    disabled={result.annotations.length === 0}
                                >
                                    {result.manuscript_name} ({result.annotations.length > 0 ?
                                    <div>{`${result.annotations.length} annotations`}</div> :
                                    <div className="text-muted">No annotations available</div>})
                                </button>
                            </h2>
                            <div
                                id={`collapse${result.manuscript_id}`}
                                className="accordion-collapse collapse"
                                aria-labelledby={`heading${result.manuscript_id}`}
                                data-bs-parent="#resultsAccordion"
                            >
                                <div className="accordion-body">
                                    <div key={result.manuscript_id}>
                                        {result.annotations.length > 0 ? (
                                            <ul className="list-group">
                                                {result.annotations.map((annotation) => (
                                                    <li
                                                        key={annotation.annotation_id}
                                                        className="list-group-item"
                                                        // onMouseOver={() => setSelectedVerse(result)}
                                                    >
                                                        <strong>Annotation:</strong> {annotation.annotation}<br/>
                                                        <strong>Annotated
                                                            Object:</strong> {annotation.annotated_object}<br/>
                                                        <strong>Type:</strong> {annotation.annotation_type}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-muted">No annotations available</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default App;
