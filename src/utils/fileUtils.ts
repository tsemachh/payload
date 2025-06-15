import crypto from 'crypto';

/**
 * Calculate SHA-256 hash of a file buffer
 * @param fileBuffer - Buffer containing file data
 * @returns Hexadecimal string representation of the hash
 */
export const calculateFileHash = (fileBuffer: Buffer): string => {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

/**
 * Check if a file with the same hash already exists in a collection
 * @param payload - Payload instance
 * @param collection - Collection name to check
 * @param hash - Hash to check for
 * @returns Object containing whether a duplicate exists and the existing document if found
 */
export const checkDuplicateFileHash = async (
  payload: any,
  collection: string,
  hash: string
): Promise<{ isDuplicate: boolean; existingDoc: any | null }> => {
  const result = await payload.find({
    collection,
    where: {
      hash: {
        equals: hash
      }
    }
  });

  const isDuplicate = result.docs.length > 0;
  const existingDoc = isDuplicate ? result.docs[0] : null;

  return {
    isDuplicate,
    existingDoc
  };
};