import { useState, useEffect } from 'react'
import {
  FileText, Send, CheckCircle2, Clock, AlertCircle, CalendarDays, Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function DailyWorkUpdate() {
  const { user, profile } = useAuth()

  const [workDescription, setWorkDescription] = useState('')
  const [issuesFaced, setIssuesFaced]         = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [loading, setLoading]                 = useState(true)
  const [todaySubmission, setTodaySubmission] = useState(null)
  const [editMode, setEditMode]               = useState(false)
  const [recentSubmissions, setRecentSubmissions] = useState([])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayDisplay = format(new Date(), 'EEEE, d MMMM yyyy')

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    try {
      // Check if already submitted today
      const { data: todaySub } = await supabase
        .from('daily_work_submissions')
        .select('*')
        .eq('profile_id', user.id)
        .eq('submission_date', todayStr)
        .maybeSingle()

      setTodaySubmission(todaySub)
      if (todaySub) {
        setWorkDescription(todaySub.work_description || '')
        setIssuesFaced(todaySub.issues_faced || '')
      }

      // Fetch recent submissions (last 7)
      const { data: recent } = await supabase
        .from('daily_work_submissions')
        .select('*')
        .eq('profile_id', user.id)
        .order('submission_date', { ascending: false })
        .limit(7)

      setRecentSubmissions(recent ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!workDescription.trim()) {
      toast.error('Please describe the work you did today')
      return
    }

    setSubmitting(true)
    try {
      if (todaySubmission && editMode) {
        // Update existing
        const { error } = await supabase
          .from('daily_work_submissions')
          .update({
            work_description: workDescription.trim(),
            issues_faced: issuesFaced.trim() || null,
          })
          .eq('id', todaySubmission.id)

        if (error) throw error
        toast.success('Work update edited successfully!')
        setEditMode(false)
      } else {
        // Insert new
        const { error } = await supabase
          .from('daily_work_submissions')
          .insert({
            profile_id: user.id,
            submission_date: todayStr,
            work_description: workDescription.trim(),
            issues_faced: issuesFaced.trim() || null,
          })

        if (error) throw error
        toast.success('Work update submitted successfully!')
      }

      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to submit work update')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const alreadySubmitted = !!todaySubmission && !editMode

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            Daily Work Update
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
            Share what you worked on today
          </p>
        </div>
        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', paddingTop: 4 }}>
          <CalendarDays size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          {todayDisplay}
        </span>
      </div>

      <div className="dwu-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* LEFT — Form */}
        <div>
          {/* Already submitted banner */}
          {alreadySubmitted && (
            <div style={{
              background: '#F0FFF4', border: '1px solid #BBF7D0',
              borderRadius: 12, padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={20} color="#16A34A" />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#16A34A' }}>
                    Today's update submitted!
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>
                    Submitted at {format(new Date(todaySubmission.created_at), 'h:mm a')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5 }}
                id="edit-work-update-btn"
              >
                <Pencil size={13} />
                Edit
              </button>
            </div>
          )}

          {/* Submitted content view */}
          {alreadySubmitted && (
            <div style={{
              background: '#FFFFFF', borderRadius: 12,
              boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24,
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
                Your Submission
              </h2>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                  Work Description
                </label>
                <div style={{
                  background: '#F8FBFF', borderRadius: 8, padding: '14px 16px',
                  fontSize: 14, color: '#1B3A6B', lineHeight: 1.6,
                  border: '1px solid #DBEAFE', whiteSpace: 'pre-wrap',
                }}>
                  {todaySubmission.work_description}
                </div>
              </div>

              {todaySubmission.issues_faced && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                    Issues / Blockers
                  </label>
                  <div style={{
                    background: '#FFF7ED', borderRadius: 8, padding: '14px 16px',
                    fontSize: 14, color: '#92400E', lineHeight: 1.6,
                    border: '1px solid #FED7AA', whiteSpace: 'pre-wrap',
                  }}>
                    {todaySubmission.issues_faced}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form (new or edit) */}
          {!alreadySubmitted && (
            <form onSubmit={handleSubmit}>
              <div style={{
                background: '#FFFFFF', borderRadius: 12,
                boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24,
              }}>
                <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
                  {editMode ? 'Edit Today\'s Update' : 'What did you work on today?'}
                </h2>

                {/* Work Description */}
                <div style={{ marginBottom: 18 }}>
                  <label
                    htmlFor="work-description"
                    style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B', display: 'block', marginBottom: 6 }}
                  >
                    Work Description <span style={{ color: '#E8192C' }}>*</span>
                  </label>
                  <textarea
                    id="work-description"
                    value={workDescription}
                    onChange={e => setWorkDescription(e.target.value)}
                    placeholder="Describe the tasks you completed, meetings attended, progress made..."
                    className="input-field"
                    rows={6}
                    style={{
                      resize: 'vertical', minHeight: 140, lineHeight: 1.6,
                      fontFamily: 'Inter, sans-serif',
                    }}
                    maxLength={2000}
                    required
                  />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
                    {workDescription.length} / 2000
                  </p>
                </div>

                {/* Issues Faced */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="issues-faced"
                    style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B', display: 'block', marginBottom: 6 }}
                  >
                    Issues / Blockers <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    id="issues-faced"
                    value={issuesFaced}
                    onChange={e => setIssuesFaced(e.target.value)}
                    placeholder="Any challenges, blockers, or issues faced today..."
                    className="input-field"
                    rows={3}
                    style={{
                      resize: 'vertical', minHeight: 80, lineHeight: 1.6,
                      fontFamily: 'Inter, sans-serif',
                    }}
                    maxLength={1000}
                  />
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting || !workDescription.trim()}
                    style={{ fontSize: 14, padding: '12px 28px' }}
                    id="submit-work-update-btn"
                  >
                    {submitting ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Send size={16} />
                        {editMode ? 'Update' : 'Submit Update'}
                      </>
                    )}
                  </button>
                  {editMode && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditMode(false)
                        setWorkDescription(todaySubmission?.work_description || '')
                        setIssuesFaced(todaySubmission?.issues_faced || '')
                      }}
                      style={{ fontSize: 13 }}
                      id="cancel-edit-btn"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* RIGHT — Recent Submissions */}
        <div>
          <div style={{
            background: '#FFFFFF', borderRadius: 12,
            boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #DBEAFE' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
                Recent Submissions
              </h2>
            </div>

            {recentSubmissions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <FileText size={32} color="#DBEAFE" style={{ marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No submissions yet</p>
              </div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {recentSubmissions.map((sub, i) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: '14px 20px',
                      borderBottom: i < recentSubmissions.length - 1 ? '1px solid #F0F7FF' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B' }}>
                        {format(new Date(sub.submission_date + 'T00:00:00'), 'd MMM yyyy')}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                        background: 'rgba(22,163,74,0.1)', color: '#16A34A',
                      }}>
                        <CheckCircle2 size={10} />
                        Submitted
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {sub.work_description}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#9CA3AF' }}>
                      <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {format(new Date(sub.created_at), 'h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dwu-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
