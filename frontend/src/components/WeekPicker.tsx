import { useState, useEffect } from 'react'

interface WeekPickerProps {
    selectedDate: Date
    onChange: (date: Date) => void
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function WeekPicker({ selectedDate, onChange }: WeekPickerProps) {
    const [viewDate, setViewDate] = useState(selectedDate)

    useEffect(() => {
        setViewDate(selectedDate)
    }, [selectedDate])

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (year: number, month: number) => {
        // 0 = Sunday, 1 = Monday, ...
        let day = new Date(year, month, 1).getDay()
        // Adjust to make Monday = 0, Sunday = 6
        return day === 0 ? 6 : day - 1
    }

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
    }

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1))
    }

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1))
    }

    const handleToday = () => {
        const today = new Date();
        setViewDate(today);
        onChange(today);
    }

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear()
    }

    const getMonday = (d: Date) => {
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        return new Date(d.setDate(diff))
    }

    const renderCalendar = () => {
        const year = viewDate.getFullYear()
        const month = viewDate.getMonth()
        const daysInMonth = getDaysInMonth(year, month)
        const firstDay = getFirstDayOfMonth(year, month)

        const days = []
        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
        }

        const selectedMonday = getMonday(new Date(selectedDate))

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i)
            const currentMonday = getMonday(new Date(date))
            const isSelected = isSameDay(currentMonday, selectedMonday)

            days.push(
                <div
                    key={i}
                    className={`calendar-day ${isSelected ? 'selected-week' : ''}`}
                    onClick={() => onChange(currentMonday)}
                    title={`Semana del ${currentMonday.toLocaleDateString()}`}
                >
                    {i}
                </div>
            )
        }

        return days
    }

    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

    return (
        <div className="calendar-container card" style={{ padding: '1rem', width: '100%' }}>
            <div className="calendar-header flex-center-wrap" style={{ marginBottom: '1rem', gap: '0.5rem', justifyContent: 'space-between' }}>
                <button className="btn btn-sm" onClick={handlePrevMonth}>&lt;</button>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        className="input"
                        style={{ padding: '0.2rem', width: 'auto', textTransform: 'capitalize' }}
                        value={viewDate.getMonth()}
                        onChange={handleMonthChange}
                    >
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    
                    <select
                        className="input"
                        style={{ padding: '0.2rem', width: 'auto' }}
                        value={viewDate.getFullYear()}
                        onChange={handleYearChange}
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm" onClick={handleToday} title="Ir a hoy">Hoy</button>
                    <button className="btn btn-sm" onClick={handleNextMonth}>&gt;</button>
                </div>
            </div>

            <div className="calendar-grid">
                <div className="day-name">L</div>
                <div className="day-name">M</div>
                <div className="day-name">M</div>
                <div className="day-name">J</div>
                <div className="day-name">V</div>
                <div className="day-name">S</div>
                <div className="day-name">D</div>
                {renderCalendar()}
            </div>

            <style>{`
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          text-align: center;
        }
        .day-name {
          font-weight: bold;
          font-size: 0.8rem;
          color: var(--muted);
          padding-bottom: 0.5rem;
        }
        .calendar-day {
          padding: 0.5rem;
          cursor: pointer;
          border-radius: 4px;
          font-size: 0.9rem;
          position: relative;
        }
        .calendar-day:hover:not(.empty) {
          background-color: var(--accent-light);
          color: var(--accent);
          font-weight: bold;
        }
        .selected-week {
          background-color: var(--accent) !important;
          color: white !important;
        }
        .empty {
          cursor: default;
        }
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
        }
        .flex-center-wrap {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
        }
      `}</style>
        </div>
    )
}
