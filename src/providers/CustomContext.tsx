'use client'
import { createContext, useContext, PropsWithChildren, useState } from 'react'

/* eslint-disable */
interface ICustomContext {
  meetingCompanies: string[]
  setMeetingCompanies: (value: string[]) => void
}
export const CustomContext = createContext<ICustomContext>({
  meetingCompanies: [],
  setMeetingCompanies: () => null,
})

export const CustomContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [meetingCompanies, setMeetingCompanies] = useState<string[]>([])

  return (
    <CustomContext.Provider
      value={{
        meetingCompanies,
        setMeetingCompanies,
      }}
    >
      {children}
    </CustomContext.Provider>
  )
}

export const useCustomContext = () => useContext(CustomContext)
