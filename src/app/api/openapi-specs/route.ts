import { promises as fs } from 'fs'
import { NextResponse } from 'next/server'
import path from 'path'
import yaml from 'js-yaml'

export async function GET() {
  try {
    // Path to your OpenAPI spec file
    const filePath = path.join(process.cwd(), 'openapi-specs.yaml')
    
    // Read the YAML file
    const yamlContent = await fs.readFile(filePath, 'utf8')
    
    // Parse YAML to JSON
    const jsonContent = yaml.load(yamlContent)
    
    // Return the JSON content
    return NextResponse.json(jsonContent)
  } catch (error) {
    console.error('Error reading or parsing OpenAPI specs:', error)
    return NextResponse.json(
      { error: 'Failed to load API specifications' },
      { status: 500 }
    )
  }
}