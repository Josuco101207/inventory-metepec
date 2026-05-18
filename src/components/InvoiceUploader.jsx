import React, { useRef, useState, useCallback } from 'react';
import { Upload, Camera, FileImage, X, AlertCircle, Cpu } from 'lucide-react';
import { getAIStatus } from '../services/invoiceAI';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_SIZE_MB = 10;

const InvoiceUploader = ({ onFileSelected, processing, disabled }) => {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const aiStatus = getAIStatus();

  const validateAndSet = useCallback((file) => {
    setError('');
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG, WebP o PDF.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo excede ${MAX_SIZE_MB}MB.`);
      return;
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  }, [validateAndSet]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }, []);

  if (processing) {
    return (
      <div className="iu-processing">
        <div className="iu-processing-inner">
          <div className="iu-spinner" />
          <div className="iu-processing-text">
            <h3>Procesando factura...</h3>
            <p>La IA está extrayendo los datos del documento</p>
          </div>
          <div className="iu-skeleton-lines">
            {[
              ['45%', '18%', '28%', '14%'],
              ['32%', '22%', '35%', '16%'],
              ['50%', '12%', '20%', '10%'],
              ['38%', '25%', '30%', '18%'],
            ].map((widths, i) => (
              <div key={i} className="iu-skeleton-row">
                <div className="iu-skeleton-block" style={{ width: widths[0] }} />
                <div className="iu-skeleton-block" style={{ width: widths[1] }} />
                <div className="iu-skeleton-block" style={{ width: widths[2] }} />
                <div className="iu-skeleton-block" style={{ width: widths[3] }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iu-container">
      {/* AI Status Badge */}
      <div className={`iu-ai-badge ${aiStatus.configured ? 'iu-ai-live' : 'iu-ai-mock'}`}>
        <Cpu size={14} />
        <span>
          {aiStatus.configured
            ? `IA conectada · ${aiStatus.provider.toUpperCase()}`
            : 'Modo Demo · Sin API Key'}
        </span>
      </div>

      {/* Drop Zone */}
      <div
        className={`iu-dropzone ${dragOver ? 'iu-dropzone-active' : ''} ${disabled ? 'iu-dropzone-disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileRef.current?.click()}
      >
        {preview ? (
          <div className="iu-preview-wrap">
            <img src={preview} alt="Preview factura" className="iu-preview-img" />
            <button className="iu-preview-clear" onClick={(e) => { e.stopPropagation(); clearPreview(); }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="iu-dropzone-content">
            <div className="iu-dropzone-icon">
              <Upload size={32} />
            </div>
            <h3>Arrastra tu factura aquí</h3>
            <p>o haz clic para seleccionar archivo</p>
            <p className="iu-formats">JPG, PNG, WebP, PDF · Máx {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="iu-actions">
        <button
          className="fly-btn fly-btn-primary iu-action-btn"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          <FileImage size={18} />
          Subir Archivo
        </button>
        <button
          className="fly-btn fly-btn-secondary iu-action-btn"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
        >
          <Camera size={18} />
          Tomar Foto
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={(e) => validateAndSet(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => validateAndSet(e.target.files?.[0])}
      />

      {/* Error */}
      {error && (
        <div className="iu-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
