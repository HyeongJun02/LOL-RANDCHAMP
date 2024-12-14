import React from 'react';
import './RoleFilter.css';

const SearchBar = ({ searchQuery, setSearchQuery }) => {
  return (
    <input
      type="text"
      className="search-bar"
      placeholder="챔피언 검색..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  );
};

export default SearchBar;
