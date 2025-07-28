'use client'
import { createContext, useContext, PropsWithChildren, useState } from 'react'
import { Toaster } from '../admincomponents/toast/toaster'

/* eslint-disable */
interface ICustomContext {
  meetingCompanies: string[]
  setMeetingCompanies: (value: string[]) => void
  stockId: string
  setStockId: (value: string) => void
}
export const CustomContext = createContext<ICustomContext>({
  meetingCompanies: [],
  setMeetingCompanies: () => null,
  stockId: '',
  setStockId: () => null,
})

export const CustomContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [meetingCompanies, setMeetingCompanies] = useState<string[]>([])
  const [stockId, setStockId] = useState<string>('')
  return (
    <CustomContext.Provider
      value={{
        meetingCompanies,
        setMeetingCompanies,
        stockId,
        setStockId,
      }}
    >
      {children}
      <Toaster />
    </CustomContext.Provider>
  )
}

export const useCustomContext = () => useContext(CustomContext)
