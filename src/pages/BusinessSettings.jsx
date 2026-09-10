import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import JSZip from 'jszip'

export default function BusinessSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [backupProgress, setBackupProgress] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('business_settings').select('*').single()
    if (data) setSettings(data)
    setLoading(false)
  }

  async function handleBackupAllFiles() {
    setBackingUp(true)
    setBackupProgress('Finding files...')
    try {
      // List everything in the invoices bucket (includes purchase bills + expense receipts)
      const { data: rootFiles, error: listError } = await supabase.storage.from('invoices').list('', { limit: 1000 })
      const { data: receiptFiles } = await supabase.storage.from('invoices').list('receipts', { limit: 1000 })

      if (listError) {
        alert('Could not list files: ' + listError.message)
        setBackingUp(false)
        return
      }

      const allPaths = [
        ...(rootFiles || []).filter((f) => f.id).map((f) => f.name),
        ...(receiptFiles || []).filter((f) => f.id).map((f) => `receipts/${f.name}`),
      ]

      if (allPaths.length === 0) {
        alert('No files uploaded yet — nothing to back up.')
        setBackingUp(false)
        return
      }

      const zip = new JSZip()
      for (let i = 0; i < allPaths.length; i++) {
        setBackupProgress(`Downloading file ${i + 1} of ${allPaths.length}...`)
        const { data: fileBlob, error } = await supabase.storage.from('invoices').download(allPaths[i])
        if (!error && fileBlob) {
          zip.file(allPaths[i], fileBlob)
        }
      }

      setBackupProgress('Creating zip file...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `titan-interio-accounts-files-backup-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Backup failed: ' + err.message)
    }
    setBackingUp(false)
    setBackupProgress('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('business_settings').update({
      business_name: settings.business_name,
      tagline: settings.tagline,
      address: settings.address,
      phone: settings.phone,
      gstin: settings.gstin,
      bank_details: settings.bank_details,
      upi_id: settings.upi_id,
      terms_and_conditions: settings.terms_and_conditions,
    }).eq('id', settings.id)

    if (error) setMessage('Error: ' + error.message)
    else setMessage('✅ Saved — this now appears on all new invoices, quotations, and challans')
    setSaving(false)
  }

  if (loading || !settings) return <p className="text-titan-steel">Loading...</p>

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Business Settings</h1>
        <p className="text-titan-steel text-sm">Printed on invoices, quotations, and challans</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-titan-dark mb-1">Backup Uploaded Files</h2>
        <p className="text-sm text-titan-steel mb-3">
          Downloads every purchase bill and expense receipt you've uploaded, as one zip file.
          Recommended every 3–6 months — save it to Google Drive or your computer, then you can
          safely delete older files from Supabase Storage if you're running low on the free 1GB.
        </p>
        <button onClick={handleBackupAllFiles} disabled={backingUp} className="btn-primary">
          {backingUp ? backupProgress || 'Preparing...' : '⬇ Download All Files (ZIP)'}
        </button>
      </div>


      <form onSubmit={handleSave} className="card space-y-3">
        <div>
          <label className="label">Business Name</label>
          <input className="input-field" value={settings.business_name} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tagline</label>
          <input className="input-field" value={settings.tagline || ''} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input-field" rows={2} value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input-field" value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">GSTIN (optional)</label>
          <input className="input-field" value={settings.gstin || ''} onChange={(e) => setSettings({ ...settings, gstin: e.target.value })} placeholder="Only shown when GST is enabled on an invoice" />
        </div>
        <div>
          <label className="label">Bank Details (optional)</label>
          <textarea className="input-field" rows={2} value={settings.bank_details || ''} onChange={(e) => setSettings({ ...settings, bank_details: e.target.value })} placeholder="Account name, number, IFSC, bank name" />
        </div>
        <div>
          <label className="label">UPI ID (optional)</label>
          <input className="input-field" value={settings.upi_id || ''} onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })} placeholder="yourname@upi" />
        </div>
        <div>
          <label className="label">Terms & Conditions</label>
          <textarea className="input-field" rows={3} value={settings.terms_and_conditions || ''} onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })} />
        </div>

        {message && <p className="text-sm">{message}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Settings'}</button>
      </form>
    </div>
  )
}
