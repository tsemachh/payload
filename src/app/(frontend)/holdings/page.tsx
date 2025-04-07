'use client'

import { useState } from 'react'
import { HoldingsFeedView } from './components/HoldingsFeedView'
import { HoldingsView } from './components/HoldingsView'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export default function Holdings() {
  const [activeTab, setActiveTab] = useState('feed')
  
  return (
    <div className="space-y-6">
      <Tabs
        defaultValue="feed" 
        onValueChange={setActiveTab}
        className="w-full"
        dir="rtl"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="view">צפייה באחזקות</TabsTrigger>
          <TabsTrigger value="feed">הזנת אחזקות</TabsTrigger>
        </TabsList>
        
        <TabsContent value="feed" className="mt-6">
          <HoldingsFeedView />
        </TabsContent>
        
        <TabsContent value="view" className="mt-6">
          <HoldingsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
