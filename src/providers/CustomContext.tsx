'use client'
import { createContext, useContext, PropsWithChildren, useState } from 'react'

/* eslint-disable */
interface ICustomContext {
  meetingCompanies: string[]
  setMeetingCompanies: (value: string[]) => void
  stockName: string
  setStockName: (value: string) => void
}
export const CustomContext = createContext<ICustomContext>({
  meetingCompanies: [],
  setMeetingCompanies: () => null,
  stockName: '',
  setStockName: () => null,
})

export const CustomContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [meetingCompanies, setMeetingCompanies] = useState<string[]>([])
  const [stockName, setStockName] = useState<string>('')
  return (
    <CustomContext.Provider
      value={{
        meetingCompanies,
        setMeetingCompanies,
        stockName,
        setStockName,
      }}
    >
      {children}
    </CustomContext.Provider>
  )
}

export const useCustomContext = () => useContext(CustomContext)
