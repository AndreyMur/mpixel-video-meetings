export const FILE_PROCESSING_QUEUE = 'file-processing';
export const FILE_PROCESSING_JOB = 'process-file';
export const FILE_PROCESSING_OPTIONS = 'FILE_PROCESSING_OPTIONS';

export interface FileProcessingJob {
  meetingFileId: string;
}

export interface FileProcessingOptions {
  attempts: number;
  backoffDelay: number;
}
