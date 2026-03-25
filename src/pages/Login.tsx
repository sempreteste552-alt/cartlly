"use client"

import { useActionState, useEffect, useState } from "react"
import { loginAction } from "@/lib/actions/auth"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)
  const router = useRouter()

  const message = "Bem-vindo à Cartly 🛒"
  const [text, setText] = useState("")

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      setText(message.slice(0, i))
      i++
      if (i > message.length) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (state?.statusRedirect) {
      router.push(state.statusRedirect)
    }
  }, [state?.statusRedirect, router])

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 transition-colors duration-300">

      {/* Glow fundo */}
      <div className="absolute -z-10 h-[500px] w-[500px] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo.png" 
            alt="AtendaAi" 
            className="h-24 w-24 object-contain drop-shadow-lg" 
          />
        </div>

        {/* Texto digitando */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl font-bold text-foreground"
            style={{
              fontFamily: "cursive",
              textShadow: "0 0 10px rgba(34,197,94,0.5)",
            }}
          >
            {text}
            <span className="animate-pulse">|</span>
          </h2>

          <p className="text-muted-foreground mt-3">
            Acesse seu painel e continue aumentando suas vendas com seu cardápio digital.
          </p>
        </div>

        {/* ===== CARD COM BORDA GIRANDO IGUAL REGISTRO ===== */}
        <div className="relative rounded-2xl p-[3px] overflow-hidden">

          {/* Camada girando */}
          <div className="absolute inset-0 rounded-2xl animate-spin-slow bg-gradient-to-r from-green-400 via-green-600 to-green-400 blur-sm opacity-80"></div>

          {/* Card real */}
          <div className="relative rounded-2xl bg-card p-6 shadow-2xl">

            <form action={formAction} className="flex flex-col gap-4">

              {state?.error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {state.error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="focus-visible:ring-green-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-green-500 hover:underline font-medium"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Digite sua senha"
                  className="focus-visible:ring-green-500"
                />
              </div>

              {/* ===== BOTÃO COM MESMO EFEITO GIRANDO ===== */}
              <div className="relative rounded-full p-[2px] overflow-hidden mt-2">

                {/* Borda girando */}
                <div className="absolute inset-0 animate-spin-slow bg-gradient-to-r from-green-400 via-green-600 to-green-400 blur-sm opacity-90"></div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="relative w-full rounded-full bg-green-500 text-white font-semibold py-3 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                >
                  {isPending ? "Entrando..." : "Acessar meu painel"}
                </button>

              </div>

              <p className="text-sm text-muted-foreground text-center mt-4">
                Ainda não tem conta?{" "}
                <Link
                  href="/register"
                  className="text-green-500 hover:underline font-medium"
                >
                  Criar conta
                </Link>
              </p>

            </form>
          </div>
        </div>

      </div>

      {/* Animação global */}
      <style global jsx>{`
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
