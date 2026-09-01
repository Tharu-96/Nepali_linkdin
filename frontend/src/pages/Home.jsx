import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Shield, MapPin, Star, Users, CheckCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Hero Section */}
      <section className="relative bg-white overflow-hidden border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              Find trusted workers near you <span className="text-primary-600">quickly and easily.</span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 mb-10">
              Connect with skilled professionals in your area for any job. From home repairs to specialized services, Rozgar makes hiring simple, secure, and fast.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/register" className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition-all duration-300">
                Get Started
              </Link>
              <Link to="/login" className="px-8 py-4 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-all duration-300">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-16">How Rozgar Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-card text-center">
              <div className="w-16 h-16 mx-auto bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6">
                <MapPin size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">1. Find Workers</h3>
              <p className="text-slate-600">Post a job or browse skilled workers based on your location and requirements.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-card text-center relative">
              <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 text-slate-300">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </div>
              <div className="w-16 h-16 mx-auto bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6">
                <Briefcase size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">2. Hire & Chat</h3>
              <p className="text-slate-600">Review profiles, chat securely in-app, and hire the best fit for your job.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-card text-center">
              <div className="w-16 h-16 mx-auto bg-success/20 text-success rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">3. Job Completed</h3>
              <p className="text-slate-600">Get the job done, pay securely through our platform, and leave a review.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Benefits */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Why Choose Rozgar?</h2>
              <p className="text-lg text-slate-600 mb-8">We built a platform that prioritizes safety, quality, and convenience for both employers and workers.</p>
              
              <ul className="space-y-6">
                <li className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Shield className="text-primary-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-bold text-slate-900">Verified Profiles</h4>
                    <p className="text-slate-600 mt-1">All workers and employers are verified to ensure a secure environment.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Star className="text-warning" size={24} />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-bold text-slate-900">Transparent Reviews</h4>
                    <p className="text-slate-600 mt-1">Make informed decisions based on genuine ratings from past jobs.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Users className="text-primary-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-bold text-slate-900">Direct Communication</h4>
                    <p className="text-slate-600 mt-1">Discuss job details securely using our built-in real-time chat.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-primary-100 rounded-3xl transform rotate-3 scale-105"></div>
              <div className="relative bg-slate-900 rounded-3xl p-8 lg:p-12 shadow-2xl">
                <h3 className="text-2xl font-bold text-white mb-6">"Rozgar changed the way I hire."</h3>
                <p className="text-slate-300 text-lg italic mb-8">
                  "Finding reliable workers used to take days. Now, I post a job and get applications from top-rated professionals near me within minutes. The payment is secure and the process is seamless."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    S
                  </div>
                  <div>
                    <h5 className="text-white font-bold">Suman T.</h5>
                    <p className="text-slate-400 text-sm">Verified Employer</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <span className="text-2xl font-bold text-white tracking-tight mb-4 block">Rozgar</span>
          <p className="text-slate-400 max-w-sm">
            Empowering communities by connecting skilled workers with local opportunities.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Platform</h4>
          <ul className="space-y-2">
            <li><Link to="/jobs" className="hover:text-primary-400 transition-colors">Find Jobs</Link></li>
            <li><Link to="/register" className="hover:text-primary-400 transition-colors">Hire Workers</Link></li>
            <li><Link to="/login" className="hover:text-primary-400 transition-colors">Sign In</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Legal</h4>
          <ul className="space-y-2">
            <li><a href="#" className="hover:text-primary-400 transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-primary-400 transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-primary-400 transition-colors">Support</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-slate-500 flex flex-col sm:flex-row justify-between items-center">
        <p>&copy; {new Date().getFullYear()} Rozgar. All rights reserved.</p>
        <p className="mt-2 sm:mt-0">Designed for a better future.</p>
      </div>
    </footer>
  );
}
