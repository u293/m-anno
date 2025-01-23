import React, {ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Autocomplete from 'react-autocomplete';
import './App.css';
import {AnnotationResult, Verse} from "./types";
import VerseComponent from "./VerseComponent";
import PopupForm from "./PopupForm";


const App: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
    const [selectedManuscript, setSelectedManuscript] = useState<string>('All Manuscripts');
    const [autocompleteResults, setAutocompleteResults] = useState<Verse[]>([]);
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

    const handleSelectVerse = (item: Verse) => {
        setSelectedVerse(item);
        setAutocompleteResults([]); // Clear the autocomplete results
        // await getAnnotations();
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

    async function selectPreviousVerse() {
        const response = await axios.get<Verse>(`http://localhost:5000/selectPreviousVerse?current=${selectedVerse?.AyahKey}`);
        if (response.data != null) {
            handleSelectVerse(response.data)
        }
    }

    async function selectNextVerse() {
        const response = await axios.get<Verse>(`http://localhost:5000/selectNextVerse?current=${selectedVerse?.AyahKey}`);
        if (response.data != null) {
            handleSelectVerse(response.data)
        }
    }

    return (
        <div className="container text-center mt-5">
            <h1 className={`project-name ${selectedVerse ? "small" : "large"}`}>
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
                        onSelect={(value, item) => {
                            handleSelectVerse(item);
                            setQuery(item.aya_text);
                        }}
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
                <VerseComponent verse={selectedVerse} selectedManuscript={selectedManuscript}
                                onSelectNextVerse={selectNextVerse} onSelectPreviousVerse={selectPreviousVerse}/>
            )}

        </div>
    );
};

export default App;
