/**
 * Compresses an image file before upload to save storage space.
 * PDFs pass through untouched (already small, and can't be resized this way).
 * A typical 3-5MB phone photo becomes roughly 200-400KB with no visible
 * quality loss for a bill/receipt.
 */
export async function compressFileIfImage(file, maxWidth = 1600, quality = 0.75) {
  if (!file.type.startsWith('image/')) {
    return file // PDFs and other files pass through unchanged
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file) // fallback to original if compression fails
              return
            }
            const compressedFile = new File([blob], file.name, { type: 'image/jpeg' })
            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => resolve(file) // fallback on any error
      img.src = e.target.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}
