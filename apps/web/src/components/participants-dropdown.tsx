'use client';

import { ChevronDown, PaperPlane, Person } from '@gravity-ui/icons';
import { AlertDialog, Button, Dropdown, toast } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState, type Key } from 'react';
import { ApiError, clearAccessToken, getAccessToken } from '@/lib/auth';
import { sendMeetingInvitation } from '@/lib/meetings';

export function ParticipantsDropdown({
  meetingId,
  participants,
  isOrganizer,
  ownEmail,
}: {
  meetingId: string;
  participants: string[];
  isOrganizer: boolean;
  ownEmail: string;
}) {
  const router = useRouter();
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const normalizedOwnEmail = ownEmail.toLowerCase();
  const isOwnEmail = (email: string) =>
    email.toLowerCase() === normalizedOwnEmail;

  const countLabel =
    participants.length === 1
      ? '1 участник'
      : `${participants.length} участников`;

  const handleAction = (key: Key) => {
    const email = String(key);
    if (!isOrganizer || isOwnEmail(email)) {
      return;
    }
    setInvitingEmail(email);
  };

  const handleSend = async (email: string) => {
    const token = getAccessToken();
    if (!token || isSending) {
      return;
    }
    setIsSending(true);
    try {
      await sendMeetingInvitation(token, meetingId, email);
      setInvitingEmail(null);
      toast.success('Приглашение отправлено');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      toast.danger(
        err instanceof Error ? err.message : 'Не удалось отправить приглашение',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dropdown>
        <Button
          variant="tertiary"
          size="sm"
          className="min-h-7 gap-1 px-2 text-sm text-muted"
          aria-label={`Участники: ${countLabel}`}
        >
          <Person aria-hidden="true" className="size-4" />
          {countLabel}
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </Button>
        <Dropdown.Popover className="min-w-[240px]">
          <Dropdown.Menu onAction={handleAction}>
            {participants.map((email) => {
              const canSend = isOrganizer && !isOwnEmail(email);
              return (
                <Dropdown.Item
                  key={email}
                  id={email}
                  textValue={email}
                  isDisabled={!canSend}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{email}</span>
                    {isOwnEmail(email) ? (
                      <span className="text-xs text-muted">Это вы</span>
                    ) : null}
                    {canSend ? (
                      <PaperPlane className="ms-auto size-3.5 shrink-0 text-muted" />
                    ) : null}
                  </span>
                </Dropdown.Item>
              );
            })}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog.Backdrop
        isOpen={invitingEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInvitingEmail(null);
          }
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent">
                <PaperPlane className="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>Отправить приглашение?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                На e-mail <strong>{invitingEmail}</strong> будет отправлено
                приглашение со ссылкой на эту встречу.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="tertiary"
                slot="close"
                onPress={() => setInvitingEmail(null)}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                isDisabled={isSending}
                isPending={isSending}
                onPress={() => {
                  if (invitingEmail) {
                    void handleSend(invitingEmail);
                  }
                }}
              >
                <PaperPlane className="size-4" />
                Отправить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
