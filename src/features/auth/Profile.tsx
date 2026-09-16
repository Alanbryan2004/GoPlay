import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Mail, ShieldAlert, CheckCircle2, Save, Camera, Upload, Link } from 'lucide-react';

export default function Profile() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        const { data, error } = await supabase
          .from('usuarios')
          .select('nome, foto')
          .eq('email', user.email)
          .single();

        if (data && !error) {
          setNome(data.nome);
          setFoto(data.foto || '');
        } else {
          setNome(user.user_metadata?.nome || '');
          setFoto(user.user_metadata?.avatar_url || '');
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  // Otimiza a imagem local e envia para o Supabase Storage (ou gera URL compacta)
  const processAndUploadImage = async (file: File, userEmail: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const MAX_SIZE_MB = 10;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        reject(new Error(`O arquivo deve ter no máximo ${MAX_SIZE_MB}MB.`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_DIM = 400; // Resolução excelente para foto de perfil

            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Erro ao processar imagem.'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Converte Canvas para Blob
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error('Erro ao converter imagem.'));
                return;
              }

              // 1. Tentar fazer o Upload no Supabase Storage
              const fileExt = 'jpg';
              const filePath = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                  contentType: 'image/jpeg',
                  upsert: true,
                });

              if (!uploadError && uploadData) {
                const { data: publicUrlData } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(filePath);
                
                if (publicUrlData?.publicUrl) {
                  resolve(publicUrlData.publicUrl);
                  return;
                }
              }

              // 2. Fallback: Se o bucket 'avatars' não existir no Supabase, reduzimos a micro-thumbnail
              const microCanvas = document.createElement('canvas');
              microCanvas.width = 80;
              microCanvas.height = 80;
              const microCtx = microCanvas.getContext('2d');
              if (microCtx) {
                microCtx.drawImage(img, 0, 0, 80, 80);
                const base64Url = microCanvas.toDataURL('image/jpeg', 0.4);
                if (base64Url.length <= 2000) {
                  resolve(base64Url);
                  return;
                }
              }

              reject(new Error('Não foi possível enviar a imagem. Crie o bucket "avatars" no Supabase Storage.'));
            }, 'image/jpeg', 0.8);
          } catch (err: any) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo local.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErro(null);

    try {
      const uploadedUrl = await processAndUploadImage(file, email);
      setFoto(uploadedUrl);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar a foto do dispositivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    setSaving(true);
    setErro(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('usuarios')
        .upsert(
          {
            email,
            nome: nome.trim(),
            foto: foto.trim(),
          },
          { onConflict: 'email' }
        );

      if (error) {
        setErro(error.message);
      } else {
        // Atualiza metadados do usuário autenticado
        await supabase.auth.updateUser({
          data: {
            nome: nome.trim(),
            avatar_url: foto.trim(),
          }
        });
        setSuccess(true);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-md mx-auto">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Meu Perfil</h1>

      <div className="glass p-6 rounded-2xl shadow-xl space-y-6">
        {/* Avatar e Upload Direct Button */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            {foto ? (
              <img
                src={foto}
                alt={nome}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-red-500/50 shadow-lg shadow-red-650/10"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-red-600 flex items-center justify-center text-white ring-4 ring-red-500/50 text-4xl font-bold shadow-lg">
                {nome ? nome.charAt(0).toUpperCase() : <User size={48} />}
              </div>
            )}

            {/* Botão / Ícone de câmera sobreposto à foto */}
            <label
              htmlFor="avatar-file-input"
              className="absolute bottom-0 right-0 p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg border-2 border-white transition-transform active:scale-95 cursor-pointer"
              title="Escolher foto da galeria"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={18} />
              )}
            </label>
          </div>

          <input
            type="file"
            id="avatar-file-input"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex items-center gap-2 mt-1">
            <label
              htmlFor="avatar-file-input"
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 py-1.5 px-3 rounded-lg border border-red-200 transition-all cursor-pointer active:scale-95"
            >
              <Upload size={14} />
              <span>Escolher do Celular</span>
            </label>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <Link size={14} />
              <span>{showUrlInput ? 'Ocultar URL' : 'Usar URL'}</span>
            </button>
          </div>

          <h2 className="text-lg font-bold text-slate-800">{nome || 'Jogador'}</h2>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 text-red-700 rounded-xl text-sm">
            <ShieldAlert size={18} className="shrink-0 text-red-400" />
            <span>{erro}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm animate-pulse">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              E-mail (Não editável)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-650">
                <Mail size={18} />
              </span>
              <input
                type="email"
                disabled
                value={email}
                className="w-full bg-slate-100/30 border border-slate-150 rounded-xl py-3 pl-11 pr-4 text-slate-500 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Nome
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-550">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-sm"
              />
            </div>
          </div>

          {showUrlInput && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                URL da Foto de Perfil (Opcional)
              </label>
              <input
                type="url"
                value={foto.startsWith('data:') ? '' : foto}
                onChange={(e) => setFoto(e.target.value)}
                placeholder="https://linkdafoto.com/perfil.jpg"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full py-3 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm mt-4 flex justify-center items-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
