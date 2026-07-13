import imageCompression from 'browser-image-compression'

const options = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
}

export async function compressImage(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, options)
    return compressed
  } catch (err) {
    console.error('Image compression failed, using original:', err)
    return file
  }
}
