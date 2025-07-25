import React, {useCallback, useEffect, useRef, useState} from "react";
import {Annotation, AnnotationResult, Verse, VerseProps, ButtonProps} from "./types";
import ContextMenu from "./ContextMenu";
import PopupForm from "./PopupForm";
import axios from "axios";
import {ChevronLeft, ChevronRight} from "lucide-react";

interface Template {
    id: string;
    annotation: string;
    annotation_Language: string;
    annotation_transliteration: string;
    annotation_type: string;
    other: string;
    displayText: string;
    template_name?: string;
}

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
    const [selectedRange, setSelectedRange] = useState<string>('');
    const [annotationToUpdate, setAnnotationToUpdate] = useState<Annotation | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [annotationResults, setAnnotationResults] = useState<AnnotationResult[]>([]);

    // New state for template ID input
    const [templateIdInput, setTemplateIdInput] = useState<string>('');
    const [isWaitingForTemplateId, setIsWaitingForTemplateId] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const preservedSelectionRef = useRef<{ text: string, range: string }>({text: '', range: ''});

    useEffect(() => {
        getAnnotations();
        setTextBefore("");
        setTextBetween(verse.aya_text);
        setTextAfter("");
    }, [verse, selectedManuscript]);

    // Add keyboard event listener
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only handle keyboard input if the popup is NOT open
            if (isPopupOpen) {
                return; // Exit if the popup is open
            }

            if (isWaitingForTemplateId && selectedText) {
                if (event.key === 'Enter') {
                    handleTemplateIdSubmit();
                } else if (event.key === 'Escape') {
                    cancelTemplateIdInput();
                } else if (event.key === 'Backspace') {
                    setTemplateIdInput(prev => prev.slice(0, -1));
                } else if (/^[0-9]$/.test(event.key)) {
                    // Only allow numeric input
                    setTemplateIdInput(prev => prev + event.key);
                }
                event.preventDefault();
            } else if (selectedText && /^[0-9]$/.test(event.key)) {
                // Start template ID input when user types a number and text is selected
                if (selectedManuscript !== 'All Manuscripts') {
                    setIsWaitingForTemplateId(true);
                    setTemplateIdInput(event.key);
                    event.preventDefault();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isWaitingForTemplateId, selectedText, templateIdInput, selectedManuscript, isPopupOpen]); // Add isPopupOpen to the dependency array

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

    // Function to get template by ID
    const getTemplateById = useCallback(async (templateId: string): Promise<Template | null> => {
        try {
            const response = await axios.get<Template>(`http://localhost:5000/get_template?id=${templateId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching template:', error);
            return null;
        }
    }, []);

    // Function to handle template ID submission
    const handleTemplateIdSubmit = useCallback(async () => {
        if (!templateIdInput.trim()) {
            cancelTemplateIdInput();
            return;
        }

        try {
            const template = await getTemplateById(templateIdInput);
            if (!template) {
                alert(`Template with ID "${templateIdInput}" not found`);
                cancelTemplateIdInput();
                return;
            }

            // Save the template annotation
            await handleAddAnnotationFromTemplate(template);

            // Reset template input state
            setIsWaitingForTemplateId(false);
            setTemplateIdInput('');

        } catch (error) {
            console.error('Error processing template:', error);
            alert('Error processing template: ' + error);
            cancelTemplateIdInput();
        }
    }, [templateIdInput]);

    // Function to cancel template ID input
    const cancelTemplateIdInput = useCallback(() => {
        setIsWaitingForTemplateId(false);
        setTemplateIdInput('');
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
        if (!isPopupOpen) {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                const range = selection.getRangeAt(0);
                const preSelectionRange = range.cloneRange();
                preSelectionRange.selectNodeContents(range.startContainer);
                preSelectionRange.setEnd(range.startContainer, range.startOffset);

                const start = preSelectionRange.toString().length;
                const end = start + selection.toString().length;

                const selectedTextValue = selection.toString();
                const selectedRangeValue = start + " - " + end;

                setSelectedText(selectedTextValue);
                setSelectedRange(selectedRangeValue);

                // Preserve selection for template usage
                preservedSelectionRef.current = {
                    text: selectedTextValue,
                    range: selectedRangeValue
                };
            } else {
                setContextMenu(null);
                setSelectedText('');
                setSelectedRange('');
                cancelTemplateIdInput();
            }
        }
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

    const handleAddAnnotationFromTemplate = useCallback(async (template: Template) => {
        if (selectedManuscript === 'All Manuscripts') {
            alert("Annotate mode does not work if no specific manuscript is selected!");
            setContextMenu(null);
            return;
        }

        try {
            console.log('Template selected:', template);
            console.log('Preserved selection at selection time:', preservedSelectionRef.current);

            // Increment template popularity first
            console.log('Incrementing popularity for template:', template.id);
            await axios.post('http://localhost:5000/increment_template_popularity', {
                template_id: template.id
            });
            console.log('Popularity incremented successfully');

            // Create annotation object with template data using preserved selection
            const annotationData = {
                manuscript_id: selectedManuscript,
                verse_id: verse.AyahKey,
                annotated_object: preservedSelectionRef.current.text,
                annotated_range: preservedSelectionRef.current.range,
                annotation_id: '',
                annotation: template.annotation,
                annotation_Language: template.annotation_Language,
                annotation_transliteration: template.annotation_transliteration,
                annotation_type: template.annotation_type,
                other: template.other,
                flag: false
            };

            console.log('Saving annotation with data:', annotationData);

            // Save annotation directly
            const response = await axios.post('http://localhost:5000/save_annotation', annotationData);
            console.log('Template annotation saved:', response.data);

            // Refresh annotations to show the newly added one
            await getAnnotations();

            // Clear selection and close context menu
            setSelectedText('');
            setSelectedRange('');
            setContextMenu(null);

            // Clear text selection in the browser
            if (window.getSelection) {
                window.getSelection()?.removeAllRanges();
            }

            // Optional: Show success message
            console.log(`Annotation from template "${template.template_name || template.displayText}" added successfully!`);

        } catch (error) {
            console.error('Error handling template annotation:', error);
            alert('Error adding annotation from template: ' + error);
        }
    }, [selectedManuscript, verse.AyahKey]);

    const handleCloseContextMenu = () => {
        setContextMenu(null);
        cancelTemplateIdInput();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setContextMenu(null);
                cancelTemplateIdInput();
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
        }
    };

    function handleUpdate(annotation: Annotation) {
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
                style={{flex: 1, margin: '0 10px', padding: '10px', position: 'relative'}}
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

                {/* Template ID Input Overlay */}
                {isWaitingForTemplateId && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        zIndex: 1000
                    }}>
                        Template ID: {templateIdInput}
                        <div style={{fontSize: '12px', marginTop: '4px', opacity: 0.8}}>
                            Press Enter to confirm, Esc to cancel
                        </div>
                    </div>
                )}

                <h4 lang="ar" className="alert-heading" style={{padding: '0.5rem'}}>
                    {textBefore}
                    <span
                        style={{
                            backgroundColor: highlight ? 'yellow' : (selectedText ? 'lightblue' : 'transparent'),
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
                        onAddAnnotationFromTemplate={handleAddAnnotationFromTemplate}
                        manuscriptId={selectedManuscript}
                        verseId={verse.AyahKey}
                        annotatedObject={selectedText}
                        selectedRange={selectedRange}
                    />
                )}
            </div>

            <Button onClick={onNextVerse} ariaLabel="Next verse">
                <ChevronRight className="h-4 w-4"/>
            </Button>
        </div>

        {/* Instructions for users */}
        {selectedText && !isWaitingForTemplateId && selectedManuscript !== 'All Manuscripts' && (
            <div style={{
                padding: '8px',
                background: '#e7f3ff',
                border: '1px solid #b3d7ff',
                borderRadius: '4px',
                marginBottom: '10px',
                fontSize: '14px'
            }}>
                💡 Tip: Type a template ID (e.g., "12") to quickly apply a template to the selected text
            </div>
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
                                        <div className="list-group">
                                            {result.annotations.map((annotation) => (
                                                <div className="card mb-3"
                                                     key={annotation.annotation_id}
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