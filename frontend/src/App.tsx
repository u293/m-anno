import React from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import DefaultPage from './DefaultPage';
import SearchAndFilters from './SearchAndFilters';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import Autocomplete from 'react-autocomplete';
import './App.css';
import {AnnotationResult, Verse} from "./types";
import VerseComponent from "./VerseComponent";
import PopupForm from "./PopupForm";


const App: React.FC = () => {
    return (
        <Router>
            <div>
                {/* Header with Navigation */}
                <nav className="navbar navbar-expand-lg navbar-light bg-light">
                    <div className="container">
                        <NavLink className="navbar-brand" to="/">Quranic Annotations</NavLink>
                        <div className="navbar-nav">
                            <NavLink className="nav-item nav-link" to="/" end>
                                Annotation Mode
                            </NavLink>
                            <NavLink className="nav-item nav-link" to="/search-and-filters">
                                Search and Filters
                            </NavLink>
                        </div>
                    </div>
                </nav>

                {/* Routes for Navigation */}
                <Routes>
                    <Route path="/" element={<DefaultPage />} />
                    <Route path="/search-and-filters" element={<SearchAndFilters />} />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
