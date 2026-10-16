import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { uploadResumeApi } from "../../api/student";

export const ResumePage: React.FC = () => {
  const { accessToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !file) return;

    setUploading(true);
    setMessage(null);
    try {
      const res = await uploadResumeApi(accessToken, file);
      setMessage({ type: "success", text: res.message || "Resume uploaded successfully!" });
      setUploadedName(file.name);
      setFile(null);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Resume Management</h2>
        <p className="text-xs text-slate-500 mt-1">Upload your latest PDF or DOCX resume for campus applications.</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          ✓ {message.text}
        </div>
      )}

      {uploadedName && (
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              PDF
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{uploadedName}</h4>
              <p className="text-xs text-slate-500">Active resume on file</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
            Active
          </span>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-8 sm:p-12 text-center bg-slate-50/50 transition">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center font-bold text-xl mb-3">
            📄
          </div>
          <p className="text-sm font-bold text-slate-800">Select your resume file</p>
          <p className="text-xs text-slate-400 mt-1">PDF or DOCX documents up to 10MB</p>
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
        </div>

        {file && (
          <div className="text-xs text-slate-600 font-semibold">
            Ready to upload: <span className="text-blue-600">{file.name}</span> ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload Resume"}
        </button>
      </form>
    </div>
  );
};
