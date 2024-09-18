import React, {useCallback, useEffect, useRef, useState} from "react";
import {Annotation, AnnotationResult, Verse, VerseProps, ButtonProps} from "./types";
import ContextMenu from "./ContextMenu";
import PopupForm from "./PopupForm";
import axios from "axios";
import {ChevronLeft, ChevronRight} from "lucide-react";

const Button: React.FC<ButtonProps> = ({children, onClick, className = '', ariaLabel, variant, size}) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            height: '100%',
            border: '1px solid #ccc',
            background: 'none',
            cursor: 'pointer'
        }}
        onClick={onClick}
        className={`px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${className}`}
        aria-label={ariaLabel}
    >
        {children}
    </div>
);

const VerseComponent: React.FC<VerseProps> = ({
                                                  verse,
                                                  selectedManuscript,
                                                  onSelectNextVerse,
                                                  onSelectPreviousVerse
                                              }) => {
    const [selectedText, setSelectedText] = useState<string>('');
    const [textBefore, setTextBefore] = useState<string>('');
    const [textBetween, setTextBetween] = useState<string>(verse.aya_text);
    const [textAfter, setTextAfter] = useState<string>('');
    const [highlight, setHighlight] = useState<boolean>(false);
    // const [selectedVerse, setSelectedVerse] = useState<Verse>(verse);
    const [selectedRange, setSelectedRange] = useState<string>('');
    const [annotationToUpdate, setAnnotationToUpdate] = useState<Annotation | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [annotationResults, setAnnotationResults] = useState<AnnotationResult[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Only make the request if the name has changed from its initial value
        // getAnnotations();
        // if (selectedVerse !== verse) {
        //     setSelectedVerse(verse)
        getAnnotations();
        setTextBefore("");
        setTextBetween(verse.aya_text);
        setTextAfter("");
        // }
    }, [verse, selectedManuscript]); // Dependencies array


    async function getAnnotations() {
        if (verse !== null) {
            try {
                const response = await axios.get<AnnotationResult[]>(`http://localhost:5000/get_annotations?query=${verse.AyahKey}`);
                setAnnotationResults(response.data);
            } catch (error) {
                alert("Error : " + error)
            }
        }
    }

    const deleteAnnotation = useCallback(async (a_id: string, m_id: string) => {
        try {
            const response = await axios.get<boolean>(`http://localhost:5000/delete_annotation?a_id=${a_id}&m_id=${m_id}`);

            if (!response) {
                throw new Error('Failed to delete item');
            }

            return true;
        } catch (error) {
            console.error('Error deleting item:', error);
            return false;
        }
    }, []);

    const openPopup = () => setIsPopupOpen(true);
    const closePopup = async (forceUpdateAnnotations: boolean) => {
        setIsPopupOpen(false);
        setAnnotationToUpdate(null);
        if (forceUpdateAnnotations) {
            await getAnnotations()
        }

    };

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

    const handleDelete = async (annotation_id: string, manuscript_id: string) => {
        let res: boolean;
        if (window.confirm(`Are you sure you want to delete this item?`)) {
            res = await deleteAnnotation(annotation_id, manuscript_id)
            if (res) {
                await getAnnotations();
            } else {
                alert("For some reason, it failed to delete")
            }
            // setAnnotationResults(annotationResults.filter(item => item.a !== id));

        }
    };

    function handleUpdate(annotation: Annotation) {
        // setSelectedText(annotation.annotated_object)
        // setSelectedRange(annotation.annotated_range)
        setAnnotationToUpdate(annotation)
        openPopup()
    }

    function highlightAnnotationOn(annotation: Annotation) {
        setHighlight(true);
        const startIndex = Number(annotation.annotated_range.split(" - ")[0])
        const endIndex = Number(annotation.annotated_range.split(" - ")[1])
        const beforeText = verse.aya_text.slice(0, startIndex);
        const highlightedText = verse.aya_text.slice(startIndex, endIndex);
        const afterText = verse.aya_text.slice(endIndex);
        setTextBefore(beforeText);
        setTextBetween(highlightedText);
        setTextAfter(afterText);
    }

    function highlightAnnotationOff(annotation: Annotation) {
        setHighlight(false);
        setTextBefore("");
        setTextBetween(verse.aya_text);
        setTextAfter("");

    }

    function onNextVerse() {
        onSelectNextVerse()
    }

    function onPreviousVerse() {
        onSelectPreviousVerse()
    }

    return (<div>
        {/*  <div className="alert alert-info" role="alert" ref={containerRef} onMouseUp={handleTextSelect}*/}
        {/*       onContextMenu={handleContextMenu}>*/}
        {/*      <PopupForm isOpen={isPopupOpen} onClose={closePopup} initialVerseId={verse.AyahKey}*/}
        {/*                 initialAnnotatedObject={selectedText} initialSelectedRange={selectedRange}*/}
        {/*                 selectedManuscript={selectedManuscript} annotationToUpdate={annotationToUpdate}/>*/}
        {/*      <h4 lang="ar" className="alert-heading">{textBefore}<span*/}
        {/*          style={{*/}
        {/*              backgroundColor: highlight ? 'yellow' : 'transparent',*/}
        {/*              borderRadius: '7px',*/}
        {/*          }}*/}
        {/*      >*/}
        {/*  {textBetween}*/}
        {/*</span>{textAfter}</h4>*/}
        {/*      /!*<p>{selectedVerse.EnglishTranslation}</p>*!/*/}
        {/*      {contextMenu && (*/}
        {/*          <ContextMenu*/}
        {/*              x={contextMenu.x}*/}
        {/*              y={contextMenu.y}*/}
        {/*              onClose={handleCloseContextMenu}*/}
        {/*              onAddAnnotationClicked={handleAddAnnotationClicked}*/}
        {/*          />*/}
        {/*      )}*/}
        {/*  </div>*/}
        <div style={{display: 'flex', alignItems: 'center', width: '100%', paddingBottom: '1rem'}}>
            <Button onClick={onPreviousVerse} ariaLabel="Previous verse">
                <ChevronLeft className="h-4 w-4"/>
            </Button>

            <div
                className="alert alert-info"
                role="alert"
                ref={containerRef}
                onMouseUp={handleTextSelect}
                onContextMenu={handleContextMenu}
                style={{flex: 1, margin: '0 10px', padding: '10px'}}
            >
                <PopupForm
                    isOpen={isPopupOpen}
                    onClose={closePopup}
                    initialVerseId={verse.AyahKey}
                    initialAnnotatedObject={selectedText}
                    initialSelectedRange={selectedRange}
                    selectedManuscript={selectedManuscript}
                    annotationToUpdate={annotationToUpdate}
                />
                <h4 lang="ar" className="alert-heading" style={{padding: '0.5rem'}}>
                    {textBefore}
                    <span
                        style={{
                            backgroundColor: highlight ? 'yellow' : 'transparent',
                            borderRadius: '7px',
                        }}
                    >
            {textBetween}
          </span>
                    {textAfter}
                </h4>
                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={handleCloseContextMenu}
                        onAddAnnotationClicked={handleAddAnnotationClicked}
                    />
                )}
            </div>

            <Button onClick={onNextVerse} ariaLabel="Next verse">
                <ChevronRight className="h-4 w-4"/>
            </Button>
        </div>
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
                                        <div className="list-group">
                                            {result.annotations.map((annotation) => (
                                                // <div
                                                //     key={annotation.annotation_id}
                                                //     className="list-group-item annotation-item"
                                                //     onMouseEnter={() => highlightAnnotationOn(annotation)}
                                                //     onMouseLeave={() => highlightAnnotationOff(annotation)}
                                                // >
                                                //     {annotation.flag && (
                                                //         <span className="flag-indicator">&#128681;</span>
                                                //     )}
                                                //     <strong>Annotated
                                                //         Object:</strong> {annotation.annotated_object}<br/>
                                                //     <strong>Verse Key:</strong> {annotation.verse_id}<br/>
                                                //     <strong>Annotation:</strong> {annotation.annotation}<br/>
                                                //     <strong>Annotation Range:</strong> {annotation.annotated_range}<br/>
                                                //     <strong>Annotation
                                                //         Language:</strong> {annotation.annotation_Language}<br/>
                                                //     <strong>Annotation Type:</strong> {annotation.annotation_type}<br/>
                                                //     <strong>Annotation
                                                //         Transliteration:</strong> {annotation.annotation_transliteration}<br/>
                                                //     <strong>Other Notes:</strong> {annotation.other}<br/>
                                                //     <button type="button" className="btn btn-primary"
                                                //             onClick={() => handleUpdate(annotation)}>Update
                                                //     </button>
                                                //     <button type="button" className="btn btn-danger"
                                                //             onClick={() => handleDelete(annotation.annotation_id, result.manuscript_id)}>Delete
                                                //     </button>
                                                // </div>
                                                <div className="card mb-3"
                                                     onMouseEnter={() => highlightAnnotationOn(annotation)}
                                                     onMouseLeave={() => highlightAnnotationOff(annotation)}>
                                                    <div className="card-header position-relative"
                                                         id={`heading-${annotation.annotation_id}`}>
                                                        <h5 className="mb-0">
                                                            <button className="btn btn-link text-start w-100"
                                                                    type="button" data-bs-toggle="collapse"
                                                                    data-bs-target={`#collapse-${annotation.annotation_id}`}
                                                                    aria-expanded="false"
                                                                    aria-controls={`collapse-${annotation.annotation_id}`}>
                                                                <strong>Annotated
                                                                    Object:</strong> {annotation.annotated_object}
                                                            </button>
                                                        </h5>
                                                        <div
                                                            className="d-flex justify-content-between align-items-center">
                                                            <div style={{paddingLeft: "0.9rem"}}>
                                                                <strong>Annotation:</strong> {annotation.annotation}
                                                            </div>
                                                            {annotation.flag && (
                                                                <span style={{padding: "0.3rem"}}
                                                                      className="flag-indicator">&#128681;</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div id={`collapse-${annotation.annotation_id}`}
                                                         className="collapse"
                                                         aria-labelledby={`heading-${annotation.annotation_id}`}>
                                                        <div className="card-body">
                                                            <div className="table-responsive">
                                                                <table className="table small-table">
                                                                    <tbody>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Verse Key:</th>
                                                                        <td>{annotation.verse_id}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Annotation
                                                                            Range:
                                                                        </th>
                                                                        <td>{annotation.annotated_range}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Annotation
                                                                            Language:
                                                                        </th>
                                                                        <td>{annotation.annotation_Language}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Annotation
                                                                            Type:
                                                                        </th>
                                                                        <td>{annotation.annotation_type}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Annotation
                                                                            Transliteration:
                                                                        </th>
                                                                        <td>{annotation.annotation_transliteration}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="w-30 text-start">Other Notes:
                                                                        </th>
                                                                        <td>{annotation.other}</td>
                                                                    </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <div className="mt-3">
                                                                <button type="button" className="btn btn-primary me-2"
                                                                        onClick={() => handleUpdate(annotation)}>Update
                                                                </button>
                                                                <button type="button" className="btn btn-danger"
                                                                        onClick={() => handleDelete(annotation.annotation_id, result.manuscript_id)}>Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            ))}
                                        </div>
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
    </div>);
};
export default VerseComponent;