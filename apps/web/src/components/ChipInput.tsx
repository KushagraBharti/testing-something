import { useState } from "react";
import { Box, Chip, Stack, TextField } from "@mui/material";

interface ChipInputProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

const ChipInput = ({ label, values, onChange, placeholder }: ChipInputProps) => {
  const [input, setInput] = useState("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }
      setInput("");
    }
  };

  const handleDelete = (chip: string) => {
    onChange(values.filter((value) => value !== chip));
  };

  return (
    <Stack spacing={1}>
      <TextField
        label={label}
        value={input}
        placeholder={placeholder}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        variant="outlined"
        fullWidth
      />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {values.map((value) => (
          <Chip key={value} label={value} onDelete={() => handleDelete(value)} color="primary" />
        ))}
      </Box>
    </Stack>
  );
};

export default ChipInput;
