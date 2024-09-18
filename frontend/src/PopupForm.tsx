import React, {useEffect, useState} from "react";
import {Annotation, PopupFormProps} from "./types";
import axios from "axios";
import Autocomplete from "react-autocomplete";

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


    // const languages = ['Ar'];
    // const annotationTypes = ['Translation'];


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        if (name == "flag") {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', annotation);

        try {
            if (annotationToUpdate !== null) {
                const response = await axios.post('http://localhost:5000/update_annotation', annotation);
                console.log('Server response:', response.data);

            } else {
                const response = await axios.post('http://localhost:5000/save_annotation', annotation);
                console.log('Server response:', response.data);

            }
            let forceUpdateAnnotations = true
            onClose(forceUpdateAnnotations);
        } catch (error) {
            alert('Error saving annotation:' + error);
        }
    };

    if (!isOpen) return null;

    const formFields = ['verse_id', 'manuscript_id', 'annotated_object', 'annotated_range', 'annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other', 'flag'];
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
                    value={key === 'verse_id' ? annotation.verse_id :
                        (key === 'annotated_object' ? annotation.annotated_object :
                            (key === 'annotated_range' ? annotation.annotated_range :
                                (key === 'manuscript_id' ? annotation.manuscript_id : '')))}
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
        } else if (key === 'flag') {
            return (
                <input
                    type="checkbox"
                    className={"form-check-input"}
                    id={key}
                    name={key}
                    checked={annotation[key]}
                    onChange={handleInputChange}
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
                        <button type="submit"
                                className="btn btn-primary mr-2">{annotationToUpdate === null ? 'Save New' : 'Update Existing'}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default PopupForm;