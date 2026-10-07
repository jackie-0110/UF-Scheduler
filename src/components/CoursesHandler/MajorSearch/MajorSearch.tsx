import React from 'react';
import Select, { CSSObjectWithLabel } from 'react-select';
import majorsData from '../../../courses/depts_clean.json'; // Import the JSON data from the file

interface MajorSearchProps {
    selectedMajor: string | null;
    setSelectedMajor: React.Dispatch<React.SetStateAction<string | null>>;
}

const MajorSelect: React.FC<MajorSearchProps> = ({ selectedMajor, setSelectedMajor }) => {
  const options = majorsData.map((major) => ({ value: major, label: major }));

  const handleChange = (selectedOption: any) => {
    setSelectedMajor(selectedOption ? selectedOption.value : null);
  };

  return (
    <div>
      <Select
        options={options}
        isClearable={true}
        value={selectedMajor ? { value: selectedMajor, label: selectedMajor } : null}
        onChange={handleChange}
        theme={(theme) => ({
          ...theme,
          borderRadius: 6,
          colors: {
            ...theme.colors,
            primary25: '#dbe5ff',
            primary: '#0f44cd',
          },
        })}
        placeholder="Select a department..."
        className="mb-4 text-black text-sm w-[100%]"
        menuPortalTarget={document.body} // Append the dropdown to the body element
        styles={{
          menuPortal: base => ({ ...base, zIndex: 999 }) as CSSObjectWithLabel, // Adjust the z-index to a value lower than the drawer's but higher than other elements
          control: (base) => ({
            ...base,
            boxShadow: "none", // Remove the box shadow to eliminate the thick border
            border: "1px solid var(--csu-line)",
            borderRadius: "12px",
          }) as CSSObjectWithLabel,
        }}
      />
    </div>
  );
};

export default MajorSelect;
