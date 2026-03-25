"use client"

import { useState } from "react"
import { Eye, EyeOff, Store } from "lucide-react"

export default function LoginPreview() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      {/* Fumaça / glow azul em volta do card */}
      <div className="absolute -z-10 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px] animate-pulse"></div>
      <div className="absolute -z-10 h-[400px] w-[400px] rounded-full bg-blue-400/20 blur-[120px] animate-pulse"></div>

      {/* Wrapper relativo */}
      <div className="relative w-full max-w-md">
        {/* Borda girando azul */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 blur-sm opacity-70 animate-spin-slow -z-10"></div>

        {/* Card real */}
        <div className="relative rounded-2xl bg-card shadow-2xl p-6">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500">
              <Store className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Painel Administrativo
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Entre com suas credenciais para acessar o painel
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 relative">
              <label htmlFor="email" className="block text-sm font-medium">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@loja.com"
                required
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="space-y-2 relative">
              <label htmlFor="password" className="block text-sm font-medium">
                Senha
              </label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full border p-2 rounded"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Botão com borda girando azul */}
            <div className="relative rounded-full p-[2px] overflow-hidden mt-2">
              <div className="absolute inset-0 animate-spin-slow bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 blur-sm opacity-90"></div>
              <button
                type="submit"
                disabled={loading}
                className="relative w-full rounded-full bg-blue-500 text-white py-3 font-semibold transition-transform duration-300 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 shadow-[0_0_20px_rgba(59,130,246,0.6)]"
              >
                {loading ? "Carregando..." : "Entrar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 6s linear infinite;
        }
      `}</style>
    </div>
  )
}
