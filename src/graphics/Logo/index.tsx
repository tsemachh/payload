'use client'
import Image from 'next/image'
import logoImage from './emda_logo.png' // Import the image file

const Logo = () => {
  return (
    <div>
      <Image
        src={logoImage} // Use the imported image file
        width={300}
        height={138}
        alt="עמדה מחקר כלכלי"
      />
    </div>
  )
}

export default Logo
