import { FileUploadArea } from '@/components/file-upload-area';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function makeFile(name: string): File {
  return new File(['content'], name, { type: 'text/plain' });
}

function dropOnZone(zone: HTMLElement, files: File[]) {
  fireEvent.dragEnter(zone, { dataTransfer: { files } });
  fireEvent.dragOver(zone, { dataTransfer: { files } });
  fireEvent.drop(zone, { dataTransfer: { files } });
}

describe('FileUploadArea', () => {
  it('renders the drop zone with instructions', () => {
    render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Перетащите файл сюда или выберите его кнопкой ниже'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Загрузить файл' }),
    ).toBeInTheDocument();
  });

  it('shows the upload error', () => {
    render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError="Неподдерживаемый формат файла"
        onUploadFiles={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Неподдерживаемый формат файла',
    );
  });

  it('shows the progress bar with the percentage while uploading', () => {
    render(
      <FileUploadArea
        isUploading
        uploadProgress={42}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('42%');
    expect(
      screen.getByLabelText('Прогресс загрузки файла'),
    ).toBeInTheDocument();
  });

  it('does not show the progress bar when not uploading', () => {
    render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('highlights the zone while dragging over', () => {
    const { container } = render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    const zone = container.querySelector('[data-testid="file-upload-area"]')!;
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    expect(zone.className).toContain('border-accent');
  });

  it('does not highlight while dragging over during an upload', () => {
    const { container } = render(
      <FileUploadArea
        isUploading
        uploadProgress={10}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    const zone = container.querySelector('[data-testid="file-upload-area"]')!;
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    expect(zone.className).not.toContain('border-accent');
  });

  it('passes dropped files to onUploadFiles', () => {
    const onUploadFiles = vi.fn().mockReturnValue(true);
    const { container } = render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={onUploadFiles}
      />,
    );
    const zone = container.querySelector(
      '[data-testid="file-upload-area"]',
    ) as HTMLElement;
    dropOnZone(zone, [makeFile('notes.txt')]);
    expect(onUploadFiles).toHaveBeenCalledTimes(1);
    expect(onUploadFiles.mock.calls[0][0][0].name).toBe('notes.txt');
  });

  it('ignores drops while uploading', () => {
    const onUploadFiles = vi.fn();
    const { container } = render(
      <FileUploadArea
        isUploading
        uploadProgress={50}
        uploadError={null}
        onUploadFiles={onUploadFiles}
      />,
    );
    const zone = container.querySelector(
      '[data-testid="file-upload-area"]',
    ) as HTMLElement;
    dropOnZone(zone, [makeFile('notes.txt')]);
    expect(onUploadFiles).not.toHaveBeenCalled();
  });

  it('passes a picked file from the input to onUploadFiles', () => {
    const onUploadFiles = vi.fn().mockReturnValue(true);
    const { container } = render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={onUploadFiles}
      />,
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile('report.pdf')] } });
    expect(onUploadFiles).toHaveBeenCalledTimes(1);
    expect(onUploadFiles.mock.calls[0][0][0].name).toBe('report.pdf');
  });

  it('shows the selected file name after picking one', () => {
    const { container } = render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={vi.fn().mockReturnValue(true)}
      />,
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile('report.pdf')] } });
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('clears the selected file when onUploadFiles rejects the pick', () => {
    const { container } = render(
      <FileUploadArea
        isUploading={false}
        uploadProgress={null}
        uploadError={null}
        onUploadFiles={vi.fn().mockReturnValue(false)}
      />,
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile('report.pdf')] } });
    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
  });

  it('disables the upload button while uploading', () => {
    render(
      <FileUploadArea
        isUploading
        uploadProgress={10}
        uploadError={null}
        onUploadFiles={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Загрузка…' })).toBeDisabled();
  });
});
