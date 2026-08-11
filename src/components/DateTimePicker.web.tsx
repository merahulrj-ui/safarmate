import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DateTimePickerProps {
  type: 'date' | 'time';
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function DateTimePicker({ type, value, onChange, placeholder }: DateTimePickerProps) {
  
  if (type === 'date') {
    const selectedDate = value ? new Date(value) : null;
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <style>{`
          .react-datepicker-wrapper { width: 100%; }
          .react-datepicker__input-container input {
            width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            font-weight: 600;
            color: #111827;
            border: none;
            background-color: transparent;
            outline: none;
            font-family: inherit;
            box-sizing: border-box;
          }
          .safar-calendar {
            border: 1px solid #E5E7EB;
            border-radius: 16px;
            padding: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            font-family: inherit;
            border-color: #F3F4F6;
          }
          .react-datepicker__header {
            background-color: white;
            border-bottom: none;
          }
          .react-datepicker__day--selected {
            background-color: #10B981 !important;
            border-radius: 50%;
          }
          .react-datepicker__day:hover {
            border-radius: 50%;
          }
        `}</style>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date | null) => {
            if (date) {
              onChange(date.toISOString());
            }
          }}
          dateFormat="dd MMM, yyyy"
          placeholderText={placeholder || "dd-mm-yyyy"}
          showPopperArrow={false}
          calendarClassName="safar-calendar"
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          scrollableYearDropdown
          yearDropdownItemNumber={100}
        />
        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: '#F0F5FA',
          padding: '6px',
          borderRadius: '8px',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#111827',
          opacity: 0.8
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
      </div>
    );
  }

  // Native Time Picker with Premium Styling
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <style>{`
        .custom-time-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          border: none;
          background-color: transparent;
          outline: none;
          font-family: inherit;
          cursor: pointer;
          box-sizing: border-box;
        }
        
        /* Premium styling for the native time picker icon */
        .custom-time-input::-webkit-calendar-picker-indicator {
          background-color: #F0F5FA;
          padding: 8px;
          border-radius: 10px;
          cursor: pointer;
          opacity: 0.8;
          transition: all 0.2s ease;
        }

        .custom-time-input::-webkit-calendar-picker-indicator:hover {
          background-color: #E1E8F0;
          opacity: 1;
          transform: scale(1.05);
        }

        /* Adjust text color when empty/placeholder */
        .custom-time-input:invalid::-webkit-datetime-edit {
          color: #9CA3AF;
        }
      `}</style>
      
      {/* @ts-ignore - valid HTML element on web */}
      <input
        type="time"
        className="custom-time-input"
        value={value}
        required
        placeholder={placeholder}
        onChange={(e: any) => onChange(e.target.value)}
      />
    </div>
  );
}
