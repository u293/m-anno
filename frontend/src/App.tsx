import React, {ReactNode, useEffect, useRef, useState} from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Autocomplete from 'react-autocomplete';
import './App.css';

interface Verse {
    AyahKey: string;
    // old verse by verse
    // SrNo: number;
    // Juz: number;
    // JuzNameArabic: string;
    // JuzNameEnglish: string;
    // SurahNo: number;
    // SurahNameArabic: string;
    // SurahNameEnglish: string;
    // SurahMeaning: string;
    // WebLink: string;
    // Classification: string;
    // AyahNo: number;
    // EnglishTranslation: string;
    // OrignalArabicText: string;
    // ArabicText: string;
    // ArabicWordCount: number;
    // ArabicLetterCount: number;

    // source : https://qurancomplex.gov.sa/en/techquran/dev/
    id: string;
    jozz: string;
    page: string;
    sura_no: string;
    sura_name_en: string;
    sura_name_ar: string;
    line_start: string;
    line_end: string;
    aya_no: string;
    aya_text: string;
}

interface Annotation {
    annotation_id: string;
    manuscript_id: string;
    verse_id: string;
    annotated_object: string;
    annotated_range: string;
    annotation: string;
    annotation_Language: string;
    annotation_transliteration: string;
    annotation_type: string;
    other: string;
}

interface AnnotationResult {
    manuscript_name: string;
    manuscript_id: string;
    annotations: Annotation[];
}

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAddAnnotationClicked: () => void;
}

interface VerseProps {
    verse: Verse;
    selectedManuscript: string;
}

interface PopupFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialVerseId: string;
    initialAnnotatedObject: string;
    initialSelectedRange: string;
    selectedManuscript: string;
}

const PopupForm: React.FC<PopupFormProps> = ({
                                                 isOpen,
                                                 onClose,
                                                 initialVerseId,
                                                 initialAnnotatedObject,
                                                 initialSelectedRange,
                                                 selectedManuscript
                                             }) => {

    const [annotation, setAnnotation] = useState<Annotation>({
        manuscript_id: selectedManuscript,
        annotation_id: '',
        verse_id: initialVerseId,
        annotated_object: initialAnnotatedObject,
        annotation: '',
        annotation_Language: '',
        annotation_transliteration: '',
        annotated_range: initialSelectedRange,
        annotation_type: '',
        other: ''
    });
    const [languages, setLanguages] = useState<Array<string>>([]);
    const [annotationTypes, setAnnotationTypes] = useState<Array<string>>([]);

    useEffect(() => {
        if (selectedManuscript !== "All Manuscripts") {
            fetch();
        }
        setAnnotation(prevAnnotation => ({
            ...prevAnnotation,
            manuscript_id: selectedManuscript,
            verse_id: initialVerseId,
            annotated_object: initialAnnotatedObject,
            annotated_range: initialSelectedRange
        }));
    }, [selectedManuscript, initialVerseId, initialAnnotatedObject, initialSelectedRange]);


    const fetch = async () => {
        try {
            const response = await axios.get<Array<string>>(`http://localhost:5000/get_languages?manuscript=${selectedManuscript}`);
            setLanguages(response.data);
        } catch (error) {
            alert('Error fetching languages: ' + error);
        }
        try {
            const response = await axios.get<Array<string>>(`http://localhost:5000/get_annotation_types?manuscript=${selectedManuscript}`);
            setAnnotationTypes(response.data);
        } catch (error) {
            alert('Error fetching annotation types: ' + error);
        }
    };


    // const languages = ['Ar'];
    // const annotationTypes = ['Translation'];


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        setAnnotation((prevAnnotation) => ({
            ...prevAnnotation,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', annotation);

        try {
            const response = await axios.post('http://localhost:5000/save-annotation', annotation);
            console.log('Server response:', response.data);
            onClose();
        } catch (error) {
            alert('Error saving annotation:' + error);
        }
    };

    if (!isOpen) return null;

    const formFields = ['verse_id', 'manuscript_id', 'annotated_object', 'annotated_range', 'annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other'];
    const handleAutocompleteChange = (field: keyof Annotation, value: string) => {
        setAnnotation((prevAnnotation) => ({
            ...prevAnnotation,
            [field]: value,
        }));
    };

    const renderInput = (key: keyof Annotation) => {
        if (key === 'verse_id' || key === 'annotated_object' || key === 'annotated_range' || key === 'manuscript_id') {
            return (
                <input
                    type="text"
                    className="form-control"
                    id={key}
                    name={key}
                    value={key === 'verse_id' ? initialVerseId : (key === 'annotated_object' ? initialAnnotatedObject : (key === 'annotated_range' ? initialSelectedRange : (key === 'manuscript_id' ? selectedManuscript : '')))}
                    disabled
                />
            );
        } else if (key === 'annotation_Language' || key === 'annotation_type') {
            const items = key === 'annotation_Language' ? languages : annotationTypes;
            return (
                <Autocomplete
                    value={annotation[key]}
                    items={items}
                    getItemValue={(item) => item}
                    shouldItemRender={(item, value) => item.toLowerCase().indexOf(value.toLowerCase()) > -1}
                    renderItem={(item, isHighlighted) => (
                        <div
                            key={item}
                            style={{background: isHighlighted ? 'lightgray' : 'white'}}
                        >
                            {item}
                        </div>
                    )}
                    onChange={(e) => handleAutocompleteChange(key, e.target.value)}
                    onSelect={(val) => handleAutocompleteChange(key, val)}
                    inputProps={{
                        className: 'form-control',
                        id: key,
                        name: key,
                    }}
                />
            );
        } else {
            return (
                <input
                    type="text"
                    className="form-control"
                    id={key}
                    name={key}
                    value={annotation[key]}
                    onChange={handleInputChange}
                />
            );
        }
    };

    return (
        <div className="popup">
            <div className="popup-content">
                <h2>Annotation Form</h2>
                <form onSubmit={handleSubmit}>
                    {formFields.map((key) => (
                        <div key={key} className="form-group">
                            <label htmlFor={key}>{key.replace('_', ' ')}:</label>
                            {renderInput(key as keyof Annotation)}
                        </div>
                    ))}
                    <div className="mt-3">
                        <button type="submit" className="btn btn-primary mr-2">Submit</button>
                        <button type="button" className="btn btn-secondary" onClick={() => onClose()}>
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ContextMenu: React.FC<ContextMenuProps> = ({x, y, onClose, onAddAnnotationClicked}) => {
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
            <button onClick={() => {
                console.log("clicked.1")
                onAddAnnotationClicked()
            }}>
                Add Annotation
            </button>
        </div>
    );
};


const Verse: React.FC<VerseProps> = ({verse, selectedManuscript}) => {
    const [selectedText, setSelectedText] = useState<string>('');
    const [selectedRange, setSelectedRange] = useState<string>('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const openPopup = () => setIsPopupOpen(true);
    const closePopup = () => setIsPopupOpen(false);

    const handleTextSelect = (event: React.MouseEvent) => {
        // if (event.target === containerRef.current) {
        if (!isPopupOpen) {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                const range = selection.getRangeAt(0);
                const preSelectionRange = range.cloneRange();
                preSelectionRange.selectNodeContents(range.startContainer);
                preSelectionRange.setEnd(range.startContainer, range.startOffset);

                const start = preSelectionRange.toString().length;
                const end = start + selectedText.length;

                setSelectedText(selection.toString());
                setSelectedRange(start + " - " + end)
            } else {
                // setSelectedText('');
                setContextMenu(null);
            }
        }
        // }
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        if (selectedText) {
            setContextMenu({x: event.clientX, y: event.clientY});
        }
    };

    const handleAddAnnotationClicked = () => {
        if (selectedManuscript === 'All Manuscripts') {
            alert("Annotate mode does not work if no specific manuscript is selected!")
        } else {
            openPopup()
        }
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
        <PopupForm isOpen={isPopupOpen} onClose={closePopup} initialVerseId={verse.AyahKey}
                   initialAnnotatedObject={selectedText} initialSelectedRange={selectedRange}
                   selectedManuscript={selectedManuscript}/>
        <h4 lang="ar" className="alert-heading">{verse.aya_text}</h4>
        {/*<p>{verse.EnglishTranslation}</p>*/}
        {contextMenu && (
            <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={handleCloseContextMenu}
                onAddAnnotationClicked={handleAddAnnotationClicked}
            />
        )}
    </div>);
};

const App: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
    const [selectedManuscript, setSelectedManuscript] = useState<string>('All Manuscripts');
    const [autocompleteResults, setAutocompleteResults] = useState<Verse[]>([]);
    const [annotationResults, setAnnotationResults] = useState<AnnotationResult[]>([]);
    const [manuscripts, setManuscripts] = useState<Array<{ manuscript_id: string, manuscript_name: string }>>([]);

    useEffect(() => {
        fetchManuscripts();
    }, []);

    const fetchManuscripts = async () => {
        try {
            const response = await axios.get<Array<{
                manuscript_id: string,
                manuscript_name: string
            }>>('http://localhost:5000/get_manuscripts');
            setManuscripts([{manuscript_id: 'all', manuscript_name: 'All Manuscripts'}, ...response.data]);
        } catch (error) {
            alert('Error fetching manuscripts: ' + error);
            // Optionally, set some error state here to show to the user
        }
    };

    const handleSelectVerse = async (item: Verse) => {
        setSelectedVerse(item);
        setQuery(item.aya_text);
        setAutocompleteResults([]); // Clear the autocomplete results
        try {
            const response = await axios.get<AnnotationResult[]>(`http://localhost:5000/get_annotations?query=${item.AyahKey}`);
            setAnnotationResults(response.data);
        } catch (error) {
            alert("Error : " + error)
        }
    };

    const handleQueryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (value.length >= 3) {
            try {
                const response = await axios.get<Verse[]>(`http://localhost:5000/search_verse?query=${value}`);
                setAutocompleteResults(response.data);
            } catch (error) {
                alert("Error : " + error)
            }
        } else {
            setAutocompleteResults([]);
        }
    };

    const handleManuscriptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedManuscript(e.target.value);
        // if (selectedVerse) {
        //     handleSelectVerse(selectedVerse);
        // }
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
                        getItemValue={(item) => item.aya_text}
                        renderMenu={(items, value) => (
                            <div
                                className="autocomplete-menu">{value.length > 0 && items.length === 0 ? `No matches for ${value}` : (items.length > 10 ? items.slice(0, 10) : items)}</div>
                        )}
                        renderItem={(item, isHighlighted) =>
                            <div className="autocomplete-item" key={item.AyahKey}
                                 style={{background: isHighlighted ? 'lightgray' : 'white'}}>
                                {`${item.AyahKey}\t${item.aya_text}`}
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
            <div className="manuscript-selection mt-3">
                {manuscripts.map((manuscript) => (
                    <div key={manuscript.manuscript_id} className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="radio"
                            name="manuscriptRadio"
                            id={`m-${manuscript.manuscript_id}`}
                            value={manuscript.manuscript_name}
                            checked={selectedManuscript === manuscript.manuscript_name}
                            onChange={handleManuscriptChange}
                        />
                        <label className="form-check-label" htmlFor={`manuscript-${manuscript.manuscript_id}`}>
                            {manuscript.manuscript_name}
                        </label>
                    </div>
                ))}
            </div>

            {selectedVerse && (
                <Verse verse={selectedVerse} selectedManuscript={selectedManuscript}/>
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
                                                        <strong>Annotated
                                                            Object:</strong> {annotation.annotated_object}<br/>
                                                        <strong>Annotation:</strong> {annotation.annotation}<br/>
                                                        <strong>Annotation
                                                            Range:</strong> {annotation.annotated_range}<br/>
                                                        <strong>Annotation
                                                            Language:</strong> {annotation.annotation_Language}<br/>
                                                        <strong>Annotation
                                                            Transliteration:</strong> {annotation.annotation_transliteration}<br/>
                                                        <strong>Other Notes:</strong> {annotation.other}<br/>
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
