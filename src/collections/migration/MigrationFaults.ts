import type { CollectionConfig } from 'payload'

const MigrationFaults: CollectionConfig= {
  slug : 'migration-faults',
  versions:false,
  fields:[
    {type:"select",name:"type",index:true,options:["stock","stock-value","stock-relation","meeting"]},
    {type:"text",name:"typeId",index:true},
    {
      type: 'textarea',
      name: "row",
      index:true
    },
    {
      type: 'textarea',
      name: "comments",
      index:true
    }
  ],
  admin:{
    group:"מיגרציה",
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50,100,200,500],
    },
  },
  labels:{
    plural: 'שגיאות במיגרציה ',
    singular: 'שגיאות במיגרציה ',
  }
}

export default MigrationFaults