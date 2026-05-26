/**
 * Generates a signed URL for a file in the private 'employee-documents' bucket.
 * Returns null if the path is empty or if an error occurs.
 *
 * @param {object} supabaseClient - Supabase client instance
 * @param {string} path           - File path within the bucket (e.g. "{uuid}/aadhar_front.jpg")
 * @param {number} expiresIn      - Seconds until the URL expires (default: 3600 = 1 hour)
 * @returns {Promise<string|null>} signed URL or null
 */
export const getSignedUrl = async (supabaseClient, path, expiresIn = 3600) => {
  if (!path) return null
  const { data, error } = await supabaseClient.storage
    .from('employee-documents')
    .createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}
