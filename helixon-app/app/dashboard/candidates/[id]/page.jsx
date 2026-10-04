"use client";

// /dashboard/candidates/[id] - one candidate's workspace: why they match, the
// full screening report (rebuilt from their latest saved analysis), their
// CV, activity timeline, stage / owner / tags / next action, outcome
// reporting, feedback links, notes, and AI-drafted emails. Contact details
// read off the CV can be corrected here.
//
// Recently-viewed tracking uses localStorage and stores candidate ids only,
// never CV contents or contact details.

import CompliancePanel from "@/components/dashboard/CompliancePanel";
import DashboardNav from "@/components/DashboardNav";
import EmailThreadPanel from "@/components/dashboard/EmailThreadPanel";
import InterviewsPanel from "@/components/dashboard/InterviewsPanel";
import PlacementPanel from "@/components/dashboard/PlacementPanel";
import SmsPanel from "@/components/dashboard/SmsPanel";
import posthog from "@/lib/posthog";
import { BookingLinksCard, CallNotesCard, CandidateDocumentsCard, MergeDuplicateCard, SelfServiceCard } from "@/components/dashboard/candidate-extras";
import { CustomFieldsCard } from "@/components/dashboard/custom-fields";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { TAG_CATALOG } from "@/lib/tag-catalog";
import { Toasts, useToasts } from "@/app/analyse/_components/ui";
import { addCandidateNote, addCandidateTag, assignCandidate, completeNextAction, createFeedbackRequest, createTag, deleteCandidate, deleteCandidateNote, editCandidateNote, emailFeedbackRequest, getCandidateById, getFeedbackRequests, getJobs, getRecruiters, getTags, logCandidateActivity, pinCandidateNote, removeCandidateTag, removeFromTalentPool, rescreenCandidate, saveToTalentPool, setCandidateNextAction, updateCandidateDetails, updateCandidateStage, updateTalentPoolEntry } from "@/lib/dashboard-api";
import { use, useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useRouter } from "next/navigation";
import { useUndoDelete } from "@/components/dashboard/use-undo-delete";
import { useUser } from "@clerk/nextjs";
import { ActivityTimeline } from "./_components/activity";
import { DocumentsSection } from "./_components/documents";
import { EditDetailsDialog, EmailPanel } from "./_components/email";
import { FeedbackRequestsPanel } from "./_components/feedback";
import { ProfileHeader } from "./_components/header";
import { NotesPanel } from "./_components/notes";
import { ExperienceSection, FullAnalysis, MatchOverview } from "./_components/overview";
import { PanelGroup, ProfileSkeleton, StateMessage } from "./_components/primitives";
import { TalentPoolPanel } from "./_components/talent-pool";
import { pushRecentlyViewed } from "./_components/utils";
import { OutcomeReportingPanel, RecruiterWorkspace } from "./_components/workspace";

export default function CandidateProfilePage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const currentUserId = clerkUser?.id ?? null;

  const [candidate, setCandidate] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | not-found
  const [reloadKey, setReloadKey] = useState(0);
  const [recruiters, setRecruiters] = useState([]);
  const [feedbackRequests, setFeedbackRequests] = useState([]);
  const [creatingFeedbackRequest, setCreatingFeedbackRequest] = useState(null);
  // Every action on this page reports a failure here - they used to fail
  // silently (a lost note, a stage that snapped back on reload).
  const { toasts, toast, dismiss } = useToasts();
  const failed = useCallback((err, fallback) => toast(err?.message || fallback, "error"), [toast]);
  const [ask, confirmDialog] = useConfirm();
  // Built-in tags straight away; the agency's own arrive from /api/tags.
  const [tags, setTags] = useState(TAG_CATALOG);
  // No prev/next-candidate endpoint exists yet - the UI already disables
  // these buttons cleanly when both are null.
  const prevId = null;
  const nextId = null;

  useEffect(() => {
    getRecruiters().then(setRecruiters).catch(() => {});
    getTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    getFeedbackRequests(id).then(setFeedbackRequests).catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    setStatus("loading");
    getCandidateById(id)
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          setStatus("not-found");
          return;
        }
        setCandidate(c);
        setStatus("ready");
        pushRecentlyViewed(id);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // After an email is sent from the profile, pull in the new timeline entry
  // without flashing the whole page back to its loading skeleton.
  const refreshActivity = useCallback(() => {
    getCandidateById(id)
      .then((c) => {
        if (c) setCandidate((prev) => (prev ? { ...prev, activity: c.activity } : prev));
      })
      .catch(() => {});
  }, [id]);

  // After scheduling or updating an interview: the stage may have moved too.
  const refreshCandidate = useCallback(() => {
    getCandidateById(id)
      .then((c) => {
        if (c) setCandidate((prev) => (prev ? { ...prev, stage: c.stage, activity: c.activity } : prev));
      })
      .catch(() => {});
  }, [id]);

  // Each resolves true when done, so the panel can close its form.
  const handleCreateFeedbackRequest = useCallback(
    async (kind, sendTo) => {
      setCreatingFeedbackRequest(kind);
      try {
        const res = await createFeedbackRequest(id, { kind, sendTo });
        if (res.request) setFeedbackRequests((list) => [res.request, ...list]);
        if (res.sendError) {
          toast(`Link created, but ${res.sendError.charAt(0).toLowerCase()}${res.sendError.slice(1)}`, "error");
        } else {
          toast(res.emailedTo ? `Feedback request sent to ${res.emailedTo}` : "Feedback link created - copy it below");
        }
        if (res.emailedTo) refreshActivity();
        return true;
      } catch (err) {
        failed(err, "Couldn't create the feedback request.");
        return false;
      } finally {
        setCreatingFeedbackRequest(null);
      }
    },
    [id, failed, toast, refreshActivity]
  );

  const handleEmailFeedbackRequest = useCallback(
    async (requestId, sendTo) => {
      setCreatingFeedbackRequest(requestId);
      try {
        await emailFeedbackRequest(id, requestId, sendTo);
        toast(`Feedback request sent to ${sendTo}`);
        refreshActivity();
        return true;
      } catch (err) {
        failed(err, "Couldn't send the email.");
        return false;
      } finally {
        setCreatingFeedbackRequest(null);
      }
    },
    [id, failed, toast, refreshActivity]
  );

  const [editingDetails, setEditingDetails] = useState(false);
  const closeEditDetails = useCallback(() => setEditingDetails(false), []);
  const handleDetailsSaved = useCallback((updated) => {
    setEditingDetails(false);
    setCandidate((c) => (c ? { ...c, ...updated } : c));
    refreshActivity();
  }, [refreshActivity]);

  const handleStageChange = useCallback(
    async (stage) => {
      const previousStage = candidate?.stage ?? null;
      const updated = await updateCandidateStage(id, stage).catch((err) => failed(err, "Couldn't move this candidate."));
      if (updated) {
        if (previousStage !== stage && posthog.__loaded) {
          posthog.capture("candidate_stage_changed", {
            from_stage: previousStage,
            to_stage: stage,
          });
        }
        setCandidate((c) => (c ? { ...c, stage: updated.stage ?? stage, subStage: updated.sub_stage ?? null } : c));
        const moved = updated.stage ?? stage;
        // "Shortlisted" (a stage) and a client shortlist (what the client
        // sees) share a word; say so at the moment someone could confuse
        // them (docs/glossary.md).
        toast(
          moved === "Shortlisted"
            ? "Moved to Shortlisted. To show them to the client, add them to a client shortlist."
            : moved === "Rejected" && candidate?.email
              ? "Moved to Rejected. A rejection email is ready to draft under Contact - nothing is sent until you send it."
              : `Moved to ${STAGE_LABELS[moved] || moved}`
        );
      }
    },
    [id, candidate, failed, toast]
  );

  const handleSubStageChange = useCallback(
    async (subStage) => {
      const updated = await updateCandidateStage(id, undefined, subStage).catch((err) => failed(err, "Couldn't update the sub-stage."));
      if (updated) {
        setCandidate((c) => (c ? { ...c, stage: updated.stage ?? c.stage, subStage: updated.sub_stage ?? null } : c));
        refreshActivity();
      }
    },
    [id, failed, refreshActivity]
  );

  const handleAssign = useCallback(
    async (recruiterId) => {
      const updated = await assignCandidate(id, recruiterId || null).catch((err) => failed(err, "Couldn't reassign this candidate."));
      if (updated) setCandidate((c) => (c ? { ...c, recruiterId: updated.recruiter_id ?? recruiterId } : c));
    },
    [id, failed]
  );

  const handleDeleteCandidate = useCallback(async () => {
    const name = candidate?.fullName || "this candidate";
    const others = candidate?.otherRoles?.length || 0;
    // They're also on file for other jobs - an erasure request has to cover
    // those records too. This used to be a native confirm() where OK meant
    // "erase everything" and Cancel meant "remove from this job only", so
    // pressing Cancel still deleted. Each choice now says what it does, and
    // Cancel really cancels.
    const scope = await ask(
      others > 0
        ? {
            title: `Delete ${name}?`,
            body: (
              <>
                <p>
                  {name} also has {others} other record{others === 1 ? "" : "s"} (screened for{" "}
                  {candidate.otherRoles.map((r) => r.jobTitle).join(", ")}).
                </p>
                <p className="mt-2">
                  For a GDPR erasure request, erase every record. Either way the CV, scores, notes and history that are
                  deleted can&apos;t be recovered.
                </p>
              </>
            ),
            choices: [
              { value: "job", label: `Remove from ${candidate.jobTitle || "this job"} only`, danger: true },
              { value: "all", label: `Erase all ${others + 1} records`, danger: true },
            ],
          }
        : {
            title: `Permanently delete ${name}?`,
            body: "This erases their CV, scores, notes and activity history, and can't be undone.",
            confirmLabel: "Delete permanently",
            danger: true,
          }
    );
    if (!scope) return;
    const everyRecord = scope === "all";
    try {
      await deleteCandidate(id, { everyRecord });
      router.push("/dashboard/candidates");
    } catch (err) {
      failed(err, "Couldn't delete this candidate. Please try again.");
    }
  }, [id, candidate, router, failed, ask]);

  const handleAddNote = useCallback(
    async (body) => {
      // Returns whether it saved, so the note box only clears on success.
      const note = await addCandidateNote(id, body).catch((err) => failed(err, "Couldn't save the note - it's still in the box."));
      if (!note) return false;
      setCandidate((c) => (c ? { ...c, notes: [note, ...c.notes] } : c));
      return true;
    },
    [id, failed]
  );

  const handleEditNote = useCallback(
    async (noteId, body) => {
      const note = await editCandidateNote(id, noteId, body).catch((err) => failed(err, "Couldn't save the note."));
      if (!note) return false;
      setCandidate((c) => (c ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? note : n)) } : c));
      return true;
    },
    [id, failed]
  );

  const undoable = useUndoDelete(toast);
  const handleDeleteNote = useCallback(
    (noteId) => {
      const note = candidate?.notes.find((n) => n.id === noteId);
      if (!note) return;
      undoable({
        key: `note:${noteId}`,
        message: "Note deleted",
        hide: () => setCandidate((c) => (c ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c)),
        restore: () => setCandidate((c) => (c && !c.notes.some((n) => n.id === noteId) ? { ...c, notes: [...c.notes, note] } : c)),
        commit: () => deleteCandidateNote(id, noteId),
      });
    },
    [id, candidate, undoable]
  );

  const handlePinNote = useCallback(
    async (noteId, pinned) => {
      const note = await pinCandidateNote(id, noteId, pinned).catch((err) => failed(err, "Couldn't pin the note."));
      if (note) setCandidate((c) => (c ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? note : n)) } : c));
    },
    [id, failed]
  );

  const handleAddTag = useCallback(
    async (tagId) => {
      const res = await addCandidateTag(id, tagId).catch((err) => failed(err, "Couldn't add the tag."));
      if (res) setCandidate((c) => (c ? { ...c, tags: res.tags } : c));
    },
    [id, failed]
  );

  const handleCreateTag = useCallback(
    async (label) => {
      const tag = await createTag(label).catch((err) => failed(err, "Couldn't create the tag."));
      if (!tag) return false;
      setTags((list) => (list.some((t) => t.id === tag.id) ? list : [...list, tag]));
      await handleAddTag(tag.id);
      return true;
    },
    [failed, handleAddTag]
  );

  const handleRemoveTag = useCallback(
    async (tagId) => {
      const res = await removeCandidateTag(id, tagId).catch((err) => failed(err, "Couldn't remove the tag."));
      if (res) setCandidate((c) => (c ? { ...c, tags: res.tags } : c));
    },
    [id, failed]
  );

  const handleSetNextAction = useCallback(
    async (payload) => {
      const res = await setCandidateNextAction(id, payload).catch((err) => failed(err, "Couldn't save the next action."));
      if (res) setCandidate((c) => (c ? { ...c, nextAction: res.nextAction } : c));
    },
    [id, failed]
  );

  const handleCompleteNextAction = useCallback(async () => {
    const res = await completeNextAction(id).catch((err) => failed(err, "Couldn't mark it done."));
    if (res) setCandidate((c) => (c ? { ...c, nextAction: res.nextAction } : c));
  }, [id, failed]);

  const handleUpdateDetails = useCallback(
    async (fields) => {
      const res = await updateCandidateDetails(id, fields).catch((err) => failed(err, "Couldn't save that change."));
      if (res) setCandidate((c) => (c ? { ...c, ...res } : c));
    },
    [id, failed]
  );

  const [loggingActivity, setLoggingActivity] = useState(null);
  const handleLogActivity = useCallback(
    async (type) => {
      setLoggingActivity(type);
      try {
        const res = await logCandidateActivity(id, type).catch((err) => failed(err, "Couldn't log that."));
        if (res?.activity) {
          setCandidate((c) => (c ? { ...c, activity: [res.activity, ...c.activity] } : c));
        }
      } finally {
        setLoggingActivity(null);
      }
    },
    [id, failed]
  );

  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    getJobs().then(setJobs).catch(() => {});
  }, []);

  const handleSaveToPool = useCallback(
    async (note) => {
      const talentPool = await saveToTalentPool(id, note).catch((err) => failed(err, "Couldn't save them to the talent pool."));
      if (!talentPool) return false;
      setCandidate((c) => (c ? { ...c, talentPool } : c));
      toast("Saved to the talent pool");
      refreshActivity();
      return true;
    },
    [id, failed, toast, refreshActivity]
  );

  const handleUpdatePool = useCallback(
    async (fields) => {
      const talentPool = await updateTalentPoolEntry(id, fields).catch((err) => failed(err, "Couldn't save that."));
      if (talentPool) setCandidate((c) => (c ? { ...c, talentPool } : c));
    },
    [id, failed]
  );

  const handleRemoveFromPool = useCallback(async () => {
    const ok = await removeFromTalentPool(id).catch((err) => failed(err, "Couldn't remove them from the pool."));
    if (!ok) return;
    setCandidate((c) => (c ? { ...c, talentPool: null } : c));
    toast("Removed from the talent pool");
    refreshActivity();
  }, [id, failed, toast, refreshActivity]);

  const handleRescreen = useCallback(
    async (jobId) => {
      try {
        const r = await rescreenCandidate(id, jobId);
        setCandidate((c) =>
          c
            ? {
                ...c,
                otherRoles: [
                  { candidateId: r.candidateId, jobId, jobTitle: r.job?.title || "Role", score: r.score, stage: "Screened" },
                  ...c.otherRoles,
                ],
              }
            : c
        );
        toast(`Screened for ${r.job?.title || "that job"}: ${r.score}`);
        refreshActivity();
        return true;
      } catch (err) {
        if (err.status === 409 && err.existingId) {
          router.push(`/dashboard/candidates/${err.existingId}`);
          return true;
        }
        failed(err, "Couldn't screen them for that job.");
        return false;
      }
    },
    [id, failed, toast, refreshActivity, router]
  );

  const focusNoteField = useCallback(() => {
    document.getElementById("candidate-note-input")?.focus();
  }, []);

  // Keyboard shortcuts - ignored while typing in a field, per the brief's
  // note not to fight normal browser/input behaviour.
  useEffect(() => {
    function onKeydown(e) {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
      if (e.key === "Escape") {
        document.activeElement?.blur();
        return;
      }
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "j" || e.key === "J") && nextId) router.push(`/dashboard/candidates/${nextId}`);
      if ((e.key === "k" || e.key === "K") && prevId) router.push(`/dashboard/candidates/${prevId}`);
      if ((e.key === "s" || e.key === "S") && candidate?.status === "completed" && candidate.stage !== "Shortlisted") {
        handleStageChange("Shortlisted");
      }
      if (e.key === "n" || e.key === "N") focusNoteField();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [nextId, prevId, candidate, router, handleStageChange, focusNoteField]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {confirmDialog}
      <DashboardNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {status === "loading" && <ProfileSkeleton />}

        {status === "error" && (
          <StateMessage title="Unable to load candidate" body="Something went wrong while loading this candidate's profile." onRetry={retry} />
        )}

        {status === "not-found" && (
          <StateMessage title="Candidate not found" body="This candidate may have been removed, or the link is out of date." />
        )}

        {status === "ready" && candidate && (
          <>
            <ProfileHeader
              candidate={candidate}
              prevId={prevId}
              nextId={nextId}
              onQuickShortlist={() => handleStageChange("Shortlisted")}
              onMoveNext={handleStageChange}
              onFocusNote={focusNoteField}
              onDelete={handleDeleteCandidate}
              onEdit={() => setEditingDetails(true)}
              onActivityLogged={refreshActivity}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6">
              {/* Main column: the assessment and the record. */}
              <div className="space-y-4 lg:space-y-6 order-2 lg:order-1">
                <MatchOverview candidate={candidate} />
                <FullAnalysis analysis={candidate.analysis} candidateName={candidate.screenedBlind ? null : candidate.fullName} />
                {candidate.status === "completed" && <InterviewsPanel candidate={candidate} onChanged={refreshCandidate} />}
                <ExperienceSection candidate={candidate} />
                <DocumentsSection candidate={candidate} />
                <CustomFieldsCard key={candidate.id} entity="candidate" recordId={candidate.id} values={candidate.customFields} onSaved={refreshActivity} />
                <ActivityTimeline activity={candidate.activity} />
              </div>
              {/* Side column, grouped by job instead of 15 panels in the order
                  they were built. On a phone it comes first, so stage and
                  notes are on the first screen rather than ~20 panels down. */}
              <div className="space-y-4 lg:space-y-6 order-1 lg:order-2">
                <PanelGroup id="work" title="Work on this candidate" defaultOpen>
                  <RecruiterWorkspace
                    candidate={candidate}
                    recruiters={recruiters}
                    tags={tags}
                    onStageChange={handleStageChange}
                    onSubStageChange={handleSubStageChange}
                    onAssign={handleAssign}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    onCreateTag={handleCreateTag}
                    onSetNextAction={handleSetNextAction}
                    onCompleteNextAction={handleCompleteNextAction}
                    onLogActivity={handleLogActivity}
                    loggingActivity={loggingActivity}
                  />
                  <NotesPanel notes={candidate.notes} currentUserId={currentUserId} onAddNote={handleAddNote} onEditNote={handleEditNote} onDeleteNote={handleDeleteNote} onPinNote={handlePinNote} />
                  <CallNotesCard candidate={candidate} onSaved={refreshCandidate} />
                </PanelGroup>
                <PanelGroup id="contact" title="Contact" summary="Email, texts, booking links and feedback requests" defaultOpen>
                  <EmailThreadPanel candidate={candidate} onChanged={refreshActivity} />
                  {/* A rejected candidate is offered the rejection email first.
                      Timely, explained outcomes are a core rule of perceived
                      fairness in selection (Gilliland, 1993, Academy of
                      Management Review 18(4)), and fairness perceptions shape
                      whether applicants recommend or reapply (Hausknecht, Day
                      & Thomas, 2004, Personnel Psychology 57(3)). Never sent
                      automatically: the recruiter reviews and sends it. */}
                  <EmailPanel
                    key={`email-${candidate.id}-${candidate.stage === "Rejected" ? "rejection" : "default"}`}
                    candidate={candidate}
                    onSent={refreshActivity}
                    initialPurpose={candidate.stage === "Rejected" ? "rejection" : undefined}
                  />
                  <SmsPanel candidate={candidate} onSent={refreshActivity} />
                  {candidate.status === "completed" && <BookingLinksCard candidate={candidate} onBooked={refreshActivity} />}
                  <FeedbackRequestsPanel
                    requests={feedbackRequests}
                    onCreate={handleCreateFeedbackRequest}
                    onEmail={handleEmailFeedbackRequest}
                    creating={creatingFeedbackRequest}
                    candidateEmail={candidate.email}
                    clientEmail={candidate.job?.client_email}
                  />
                  <SelfServiceCard candidate={candidate} />
                </PanelGroup>
                <PanelGroup
                  id="place"
                  title="Placement & compliance"
                  summary="Offer, placement, right to work and documents"
                  defaultOpen={candidate.stage === "Offer" || candidate.stage === "Placed"}
                >
                  {candidate.status === "completed" && <PlacementPanel candidate={candidate} onChanged={refreshCandidate} />}
                  <OutcomeReportingPanel candidate={candidate} onUpdateDetails={handleUpdateDetails} />
                  <CompliancePanel candidate={candidate} onChanged={refreshActivity} />
                  {candidate.status === "completed" && <CandidateDocumentsCard candidate={candidate} />}
                </PanelGroup>
                <PanelGroup id="later" title="Keep for later & tidy up" summary="Talent pool and merging duplicates">
                  <TalentPoolPanel
                    candidate={candidate}
                    jobs={jobs}
                    onSave={handleSaveToPool}
                    onUpdate={handleUpdatePool}
                    onRemove={handleRemoveFromPool}
                    onRescreen={handleRescreen}
                  />
                  <MergeDuplicateCard candidate={candidate} />
                </PanelGroup>
              </div>
            </div>
          </>
        )}
      </div>
      {editingDetails && candidate && (
        <EditDetailsDialog candidate={candidate} onCancel={closeEditDetails} onSaved={handleDetailsSaved} />
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
