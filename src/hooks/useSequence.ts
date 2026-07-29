'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Sequence, SequenceStep, PendingFollowUp } from '@/types/sequence';
import { Lead } from '@/types/lead';
import { sequenceService } from '@/services/sequence.service';

export function useSequence() {
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches sequence and its steps for a given lead ID.
   */
  const fetchLeadSequence = useCallback(async (leadId: string) => {
    setLoading(true);
    setError(null);
    try {
      const seq = await sequenceService.getSequenceByLeadId(leadId);
      setSequence(seq);

      if (seq) {
        const stepList = await sequenceService.getStepsBySequenceId(seq.id);
        setSteps(stepList);
      } else {
        setSteps([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sequence';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches today's pending follow-ups across user leads.
   */
  const fetchTodayPendingFollowUps = useCallback(async (userLeads: Lead[]) => {
    setLoading(true);
    setError(null);
    try {
      const list = await sequenceService.getTodayPendingFollowUps(userLeads);
      setPendingFollowUps(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load today follow-ups';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Marks a step as sent and updates state optimistically.
   */
  const markStepAsSent = async (stepId: string): Promise<boolean> => {
    try {
      await sequenceService.markStepAsSent(stepId);
      toast.success('Follow-up marked as Sent!');

      // Update steps state
      setSteps((prev) =>
        prev.map((s) =>
          s.id === stepId ? { ...s, status: 'Sent', sentAt: new Date().toISOString() } : s
        )
      );

      // Remove from pending follow-ups state
      setPendingFollowUps((prev) => prev.filter((item) => item.step.id !== stepId));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update step status';
      toast.error(msg);
      return false;
    }
  };

  /**
   * Marks a step as skipped and updates state optimistically.
   */
  const skipStep = async (stepId: string): Promise<boolean> => {
    try {
      await sequenceService.skipStep(stepId);
      toast.info('Follow-up step skipped.');

      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: 'Skipped' } : s))
      );

      setPendingFollowUps((prev) => prev.filter((item) => item.step.id !== stepId));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to skip step';
      toast.error(msg);
      return false;
    }
  };

  return {
    sequence,
    steps,
    pendingFollowUps,
    loading,
    error,
    fetchLeadSequence,
    fetchTodayPendingFollowUps,
    markStepAsSent,
    skipStep,
  };
}
