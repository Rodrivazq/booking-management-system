export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'superadmin'
  funcNumber?: string
  phoneNumber?: string
  photoUrl?: string
  preferences?: {
    theme?: 'light' | 'dark'
  }
  lastReservation?: string
}

export interface Reservation {
  id: string
  userId: string
  week: string // YYYY-MM-DD (monday)
  days: {
    [key: string]: { // monday, tuesday...
      meal: string
      dessert: string
      bread?: boolean
    }
  }
  timeSlot: string
  name?: string // Joined from user
  email?: string // Joined from user
  funcNumber?: string // Joined from user
  selections?: { day: string, meal: string, dessert: string, bread: boolean }[]
}

export interface Menu {
  id: string
  weekStart: string
  days: {
    [key: string]: {
      meals: string[]
      desserts: string[]
    }
  }
}
