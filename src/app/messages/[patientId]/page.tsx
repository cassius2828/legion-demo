import { MessageThread } from "~/app/messages/thread";

export default async function PatientMessagesPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <MessageThread patientId={patientId} />;
}
