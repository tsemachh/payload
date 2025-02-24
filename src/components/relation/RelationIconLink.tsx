'use client'
import { RelationshipField, useField, useStepNav } from '@payloadcms/ui'
import { RelationshipFieldClientProps } from 'payload'
import { ArrowRightToBracket } from 'flowbite-react-icons/outline'
import { useRef } from 'react'

//throw event /context on click
const RelationInRightPanelField: React.FC<RelationshipFieldClientProps> = (props) => {

  //const { stepNav } = useStepNav()
  const { path } = props
  const { value: stockLink } = useField<string>({
    path: path,
  })
  const isFirstClick = useRef(true)

  const handleClick = () => {
   
      if (isFirstClick.current) {
   // open link
      } else {
        isFirstClick.current = false
      }
   
  }

  return (
    <div className="flex items-center">
      <RelationshipField {...props} />
      {stockLink && (
        <ArrowRightToBracket
          size={14}
          onClick={handleClick}
          className="cursor-pointer ml-[5px] mt-[10px]"
        />
      )}
    </div>
  )
}

export default RelationInRightPanelField