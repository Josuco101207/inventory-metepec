import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Camera, FileImage, X, AlertCircle, Cpu } from 'lucide-react';
import { getAIStatus, setOCRProgressCallback } from '../services/invoiceAI';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_SIZE_MB = 10;

const InvoiceUploader = ({ onFileSelected, processing, disabled, initialPreview }) => {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(initialPreview || null);
  const [error, setError] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const aiStatus = getAIStatus();

  // Sincronizar preview con prop externa si cambia
  useEffect(() => {
    if (initialPreview !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(initialPreview);
    }
  }, [initialPreview]);

  useEffect(() => {
    if (processing && aiStatus.provider === 'ocr') {
      setOCRProgressCallback(setOcrProgress);
      return () => setOCRProgressCallback(null);
    }
  }, [processing, aiStatus.provider]);

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
    onFileSelected?.(null);
  }, [onFileSelected]);

  if (processing) {
    return (
      <div className="iu-processing">
        <div className="iu-processing-inner">
          <div className="iu-spinner" />
          <div className="iu-processing-text">
            <h3>Procesando factura...{aiStatus.provider === 'ocr' && ocrProgress > 0 ? ` ${ocrProgress}%` : ''}</h3>
            <p>{aiStatus.provider === 'ocr' ? 'OCR analizando el documento (procesamiento local)' : 'La IA está extrayendo los datos del documento'}</p>
            {aiStatus.provider === 'ocr' && ocrProgress > 0 && (
              <div className="iu-progress-bar">
                <div className="iu-progress-fill" style={{ width: `${ocrProgress}%` }} />
              </div>
            )}
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
      <div className={`iu-ai-badge ${aiStatus.configured ? 'iu-ai-live' : aiStatus.provider === 'ocr' ? 'iu-ai-ocr' : 'iu-ai-mock'}`}>
        <Cpu size={14} />
        <span>
          {aiStatus.configured
            ? `IA conectada · ${aiStatus.provider.toUpperCase()}`
            : aiStatus.provider === 'ocr'
              ? 'OCR Local · Tesseract.js'
              : 'Modo Demo · Sin API Key'}
        </span>
      </div>

      {/* Drop Zone */}
      <div
        className={`iu-dropzone ${dragOver ? 'iu-dropzone-active' : ''} ${disabled ? 'iu-dropzone-disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
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
            <h3>Sube tu factura para extraer datos</h3>
            <p>Arrastra tu archivo PDF o Imagen aquí</p>
            
            <div className="iu-actions-inline">
              <button
                className="fly-btn fly-btn-primary iu-action-btn-inline"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
              >
                <FileImage size={16} />
                Explorar
              </button>
              <button
                className="fly-btn fly-btn-secondary iu-action-btn-inline"
                onClick={() => cameraRef.current?.click()}
                disabled={disabled}
              >
                <Camera size={16} />
                Tomar Foto
              </button>
            </div>

            <p className="iu-formats">Soporta: JPG, PNG, WebP, PDF · Máx {MAX_SIZE_MB}MB</p>
          </div>
        )}
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
