import React, {useEffect, useState, useRef} from "react";
import {Annotation, PopupFormProps} from "./types";
import axios from "axios";

interface Template {
    id: string;
    annotation: string;
    annotation_Language: string;
    annotation_transliteration: string;
    annotation_type: string;
    other: string;
    displayText: string;
}

interface AutocompleteProps {
    value: string;
    field: keyof Annotation;
    onValueChange: (field: keyof Annotation, value: string) => void;
    onTemplateSelect: (template: Template) => void;
    manuscriptId: string;
}

const DualAutocomplete: React.FC<AutocompleteProps> = ({
                                                           value,
                                                           field,
                                                           onValueChange,
                                                           onTemplateSelect,
                                                           manuscriptId
                                                       }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [attributeSuggestions, setAttributeSuggestions] = useState<string[]>([]);
    const [templateSuggestions, setTemplateSuggestions] = useState<Template[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [highlightedSection, setHighlightedSection] = useState<'attribute' | 'template'>('attribute');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = async (query: string) => {
        if (query.length < 1) {
            setAttributeSuggestions([]);
            setTemplateSuggestions([]);
            return;
        }

        try {
            // Fetch attribute-level suggestions
            const attributeResponse = await axios.get<string[]>(
                `http://localhost:5000/get_attribute_suggestions?manuscript=${manuscriptId}&field=${field}&query=${query}`
            );
            setAttributeSuggestions(attributeResponse.data);

            // Fetch template suggestions
            const templateResponse = await axios.get<Template[]>(
                `http://localhost:5000/get_template_suggestions?manuscript=${manuscriptId}&query=${query}`
            );
            setTemplateSuggestions(templateResponse.data);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onValueChange(field, newValue);
        fetchSuggestions(newValue);
        setIsOpen(true);
        setHighlightedIndex(-1);
        setHighlightedSection('attribute');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        const totalAttributeItems = attributeSuggestions.length;
        const totalTemplateItems = templateSuggestions.length;
        const totalItems = totalAttributeItems + totalTemplateItems;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (highlightedIndex < totalItems - 1) {
                    const newIndex = highlightedIndex + 1;
                    setHighlightedIndex(newIndex);
                    setHighlightedSection(newIndex < totalAttributeItems ? 'attribute' : 'template');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (highlightedIndex > 0) {
                    const newIndex = highlightedIndex - 1;
                    setHighlightedIndex(newIndex);
                    setHighlightedSection(newIndex < totalAttributeItems ? 'attribute' : 'template');
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0) {
                    if (highlightedSection === 'attribute' && highlightedIndex < totalAttributeItems) {
                        selectAttributeSuggestion(attributeSuggestions[highlightedIndex]);
                    } else if (highlightedSection === 'template') {
                        const templateIndex = highlightedIndex - totalAttributeItems;
                        if (templateIndex < totalTemplateItems) {
                            selectTemplateSuggestion(templateSuggestions[templateIndex]);
                        }
                    }
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const selectAttributeSuggestion = (suggestion: string) => {
        onValueChange(field, suggestion);
        setIsOpen(false);
    };

    const selectTemplateSuggestion = (template: Template) => {
        onTemplateSelect(template);
        setIsOpen(false);
    };

    return (
        <div className="autocomplete-container" style={{ position: 'relative' }} ref={dropdownRef}>
            <input
                ref={inputRef}
                type="text"
                className="form-control"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => value && setIsOpen(true)}
                placeholder={`Enter ${field.replace('_', ' ')}...`}
                style={{
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    width: '100%',
                    boxSizing: 'border-box'
                }}
            />
            {isOpen && (attributeSuggestions.length > 0 || templateSuggestions.length > 0) && (
                <div
                    className="autocomplete-dropdown"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        maxHeight: '500px',
                        display: 'flex'
                    }}
                >
                    {/* Attribute Suggestions */}
                    {attributeSuggestions.length > 0 && (
                        <div style={{ flex: 1, borderRight: '1px solid #eee' }}>
                            <div
                                style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#f8f9fa',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                {field.replace('_', ' ').toUpperCase()} SUGGESTIONS
                            </div>
                            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                {attributeSuggestions.map((suggestion, index) => (
                                    <div
                                        key={`attr-${index}`}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            backgroundColor: highlightedIndex === index && highlightedSection === 'attribute'
                                                ? '#e3f2fd' : 'white',
                                            fontSize: '14px',
                                            borderBottom: '1px solid #f0f0f0'
                                        }}
                                        onClick={() => selectAttributeSuggestion(suggestion)}
                                        onMouseEnter={() => {
                                            setHighlightedIndex(index);
                                            setHighlightedSection('attribute');
                                        }}
                                    >
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Template Suggestions */}
                    {templateSuggestions.length > 0 && (
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#f8f9fa',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                TEMPLATE SUGGESTIONS
                            </div>
                            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                {templateSuggestions.map((template, index) => {
                                    const globalIndex = attributeSuggestions.length + index;
                                    return (
                                        <div
                                            key={`template-${template.id}`}
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                backgroundColor: highlightedIndex === globalIndex && highlightedSection === 'template'
                                                    ? '#e8f5e8' : 'white',
                                                fontSize: '14px',
                                                lineHeight: '1.4',
                                                borderBottom: '1px solid #f0f0f0'
                                            }}
                                            onClick={() => selectTemplateSuggestion(template)}
                                            onMouseEnter={() => {
                                                setHighlightedIndex(globalIndex);
                                                setHighlightedSection('template');
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                                {template.displayText}
                                            </div>
                                            <div style={{ color: '#666', fontSize: '11px' }}>
                                                Click to fill all template fields
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const PopupForm: React.FC<PopupFormProps> = ({
                                                 isOpen,
                                                 onClose,
                                                 initialVerseId,
                                                 initialAnnotatedObject,
                                                 initialSelectedRange,
                                                 selectedManuscript,
                                                 annotationToUpdate
                                             }) => {
    const [annotation, setAnnotation] = useState<Annotation>({
        manuscript_id: annotationToUpdate !== null ? annotationToUpdate.manuscript_id : selectedManuscript,
        annotation_id: annotationToUpdate !== null ? annotationToUpdate.annotation_id : '',
        verse_id: annotationToUpdate !== null ? annotationToUpdate.verse_id : initialVerseId,
        annotated_object: annotationToUpdate !== null ? annotationToUpdate.annotated_object : initialAnnotatedObject,
        annotation: annotationToUpdate !== null ? annotationToUpdate.annotation : '',
        annotation_Language: annotationToUpdate !== null ? annotationToUpdate.annotation_Language : '',
        annotation_transliteration: annotationToUpdate !== null ? annotationToUpdate.annotation_transliteration : '',
        annotated_range: annotationToUpdate !== null ? annotationToUpdate.annotated_range : initialSelectedRange,
        annotation_type: annotationToUpdate !== null ? annotationToUpdate.annotation_type : '',
        other: annotationToUpdate !== null ? annotationToUpdate.other : '',
        flag: annotationToUpdate !== null ? annotationToUpdate.flag : false
    });

    const [languages, setLanguages] = useState<Array<string>>([]);
    const [annotationTypes, setAnnotationTypes] = useState<Array<string>>([]);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);

    useEffect(() => {
        if (selectedManuscript !== "All Manuscripts") {
            fetch(selectedManuscript);
        }
        if (annotationToUpdate !== null) {
            fetch(annotationToUpdate.manuscript_id);
            setAnnotation(annotationToUpdate);
        } else {
            setAnnotation(prevAnnotation => ({
                manuscript_id: selectedManuscript,
                verse_id: initialVerseId,
                annotated_object: initialAnnotatedObject,
                annotated_range: initialSelectedRange,
                annotation_id: '',
                annotation: '',
                annotation_Language: '',
                annotation_transliteration: '',
                annotation_type: '',
                other: '',
                flag: false
            }));
        }
    }, [selectedManuscript, initialVerseId, initialAnnotatedObject, initialSelectedRange, annotationToUpdate]);

    const fetch = async (m_id: string) => {
        try {
            const response = await axios.get<Array<string>>(`http://localhost:5000/get_languages?manuscript=${m_id}`);
            setLanguages(response.data);
        } catch (error) {
            alert('Error fetching languages: ' + error);
        }
        try {
            const response = await axios.get<Array<string>>(`http://localhost:5000/get_annotation_types?manuscript=${m_id}`);
            setAnnotationTypes(response.data);
        } catch (error) {
            alert('Error fetching annotation types: ' + error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        if (name === "flag") {
            setAnnotation((prevAnnotation) => ({
                ...prevAnnotation,
                ['flag']: !prevAnnotation['flag'],
            }));
        } else {
            setAnnotation((prevAnnotation) => ({
                ...prevAnnotation,
                [name]: value,
            }));
        }
    };

    const handleAutocompleteChange = (field: keyof Annotation, value: string) => {
        setAnnotation((prevAnnotation) => ({
            ...prevAnnotation,
            [field]: value,
        }));
    };

    const handleTemplateSelect = (template: Template) => {
        setAnnotation((prevAnnotation) => ({
            ...prevAnnotation,
            annotation: template.annotation,
            annotation_Language: template.annotation_Language,
            annotation_transliteration: template.annotation_transliteration,
            annotation_type: template.annotation_type,
            other: template.other,
        }));
    };

    const saveTemplate = async () => {
        try {
            const templateData = {
                manuscript_id: annotation.manuscript_id,
                annotation: annotation.annotation,
                annotation_Language: annotation.annotation_Language,
                annotation_transliteration: annotation.annotation_transliteration,
                annotation_type: annotation.annotation_type,
                other: annotation.other
            };
            await axios.post('http://localhost:5000/save_template', templateData);
            alert('Template saved successfully!');
        } catch (error) {
            alert('Error saving template: ' + error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', annotation);

        try {
            if (saveAsTemplate) {
                await saveTemplate();
            }

            if (annotationToUpdate !== null) {
                const response = await axios.post('http://localhost:5000/update_annotation', annotation);
                console.log('Server response:', response.data);
            } else {
                const response = await axios.post('http://localhost:5000/save_annotation', annotation);
                console.log('Server response:', response.data);
            }

            let forceUpdateAnnotations = true;
            onClose(forceUpdateAnnotations);
        } catch (error) {
            alert('Error saving annotation:' + error);
        }
    };

    if (!isOpen) return null;

    const autocompleteFields = ['annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other'];
    const formFields = ['verse_id', 'manuscript_id', 'annotated_object', 'annotated_range', 'annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other', 'flag'];

    const renderInput = (key: keyof Annotation) => {
        const inputStyle = {
            padding: '12px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            width: '100%',
            boxSizing: 'border-box' as const
        };

        const disabledInputStyle = {
            ...inputStyle,
            backgroundColor: '#f8f9fa',
            color: '#6c757d'
        };

        if (key === 'verse_id' || key === 'annotated_object' || key === 'annotated_range' || key === 'manuscript_id') {
            return (
                <input
                    type="text"
                    className="form-control"
                    id={key}
                    name={key}
                    value={key === 'verse_id' ? annotation.verse_id :
                        (key === 'annotated_object' ? annotation.annotated_object :
                            (key === 'annotated_range' ? annotation.annotated_range :
                                (key === 'manuscript_id' ? annotation.manuscript_id : '')))}
                    disabled
                    style={disabledInputStyle}
                />
            );
        } else if (autocompleteFields.includes(key)) {
            return (
                <DualAutocomplete
                    value={annotation[key] as string}
                    field={key}
                    onValueChange={handleAutocompleteChange}
                    onTemplateSelect={handleTemplateSelect}
                    manuscriptId={annotation.manuscript_id}
                />
            );
        } else if (key === 'flag') {
            return (
                <input
                    type="checkbox"
                    className={"form-check-input"}
                    id={key}
                    name={key}
                    checked={annotation[key]}
                    onChange={handleInputChange}
                    style={{
                        width: '20px',
                        height: '20px',
                        float: 'left'
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
                    style={inputStyle}
                />
            );
        }
    };

    return (
        <div className="popup" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div className="popup-content" style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                width: '90%',
                maxWidth: '1200px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}>
                <h2 style={{ marginBottom: '24px', textAlign: 'center', color: '#333' }}>Annotation Form</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '35% 65%', gap: '4px', marginBottom: '20px' }}>
                        {/* Left Column - First 4 attributes */}
                        <div style={{ display: 'table', width: '100%' }}>
                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '140px' }}>
                                    <label htmlFor="verse_id" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Verse ID:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('verse_id')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '140px' }}>
                                    <label htmlFor="manuscript_id" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Manuscript ID:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('manuscript_id')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '140px' }}>
                                    <label htmlFor="annotated_object" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotated Object:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotated_object')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '140px' }}>
                                    <label htmlFor="annotated_range" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotated Range:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotated_range')}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Remaining 6 attributes */}
                        <div style={{ display: 'table', width: '100%' }}>
                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="annotation" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotation:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotation')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="annotation_Language" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotation Language:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotation_Language')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="annotation_transliteration" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotation Transliteration:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotation_transliteration')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="annotation_type" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Annotation Type:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('annotation_type')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="other" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Other:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('other')}
                                </div>
                            </div>

                            <div style={{ display: 'table-row' }}>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px', paddingRight: '16px', width: '180px' }}>
                                    <label htmlFor="flag" style={{ fontWeight: 'bold', color: '#555', margin: 0 }}>
                                        Flag:
                                    </label>
                                </div>
                                <div style={{ display: 'table-cell', verticalAlign: 'middle', paddingBottom: '20px' }}>
                                    {renderInput('flag')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Template Save Option */}
                    <div className="form-group" style={{
                        marginBottom: '24px',
                        padding: '16px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        border: '1px solid #e9ecef'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id="saveAsTemplate"
                                checked={saveAsTemplate}
                                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                style={{ marginRight: '8px' }}
                            />
                            <label className="form-check-label" htmlFor="saveAsTemplate" style={{ fontWeight: 'bold', color: '#555' }}>
                                Save as template (saves annotation, language, transliteration, type, and other fields)
                            </label>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button
                            type="submit"
                            style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            {annotationToUpdate === null ? 'Save New' : 'Update Existing'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onClose(false)}
                            style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PopupForm;