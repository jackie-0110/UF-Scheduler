import React, { useEffect, useRef } from "react";
import axios from "axios";
import "./styles.css";
import { FaSearch } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useAuth } from "react-oidc-context";

import { BACKEND_URLS, getAuthHeaders } from "../../../config/api";

interface CourseSearchProps {
  setDebouncedSearchTerm: (searchTerm: string) => void;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  searchTrigger: boolean;
  setSearchTrigger: React.Dispatch<React.SetStateAction<boolean>>;
}

const CourseSearch: React.FC<CourseSearchProps> = ({
  setDebouncedSearchTerm,
  searchTerm,
  setSearchTerm,
  searchTrigger,
  setSearchTrigger,
}) => {
  const auth = useAuth();

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = (value: string) => {
    clearTimeout(debounceTimer.current);
    setDebouncedSearchTerm(value);
    setSearchTrigger((prev) => !prev);
  };

  // Search as you type; Enter still searches immediately
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSearch(value), 300);
  };

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const handleSearchKeyPress = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      const value = event.currentTarget.value;
      runSearch(value);
      if (value !== "" && value.length === 7) {
        handleSearchMetrics(value);
      }
    }
  };

  const handleSearchMetrics = async (formattedInput: string) => {
    try {
      await axios.post(
        BACKEND_URLS.SEARCH_METRICS,
        { search_term: formattedInput },
        { headers: getAuthHeaders(auth) }
      );
    } catch (error) {
      // Metrics send failed silently
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="search-container flex-grow">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search by code, title, or instructor"
          id="search-input"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyPress}
          autoCorrect="off"
          className="search-input"
          style={{ zIndex: 998 }}
        />
        {searchTerm && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setSearchTerm("");
              runSearch("");
              document.getElementById("search-input")?.focus();
            }}
          >
            <IoClose size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseSearch;
