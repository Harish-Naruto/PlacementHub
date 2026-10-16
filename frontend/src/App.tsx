import './App.css'

function App() {

 return (
    <div className="min-h-screen bg-[#080B16] text-white flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-bold">
        Welcome to <span className="text-violet-400">PlacementHub</span>
      </h1>

      <p className="mt-4 max-w-xl text-gray-400">
        Stop claiming skills. Start proving them. Discover jobs,
        showcase verified skills, and build truthful AI-powered resumes.
      </p>

      <button className="mt-8 rounded-lg bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500">
        Get Started →
      </button>
    </div>
  )
}
export default App
