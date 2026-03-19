import React from "react";

// Dummy data for accounts and transactions
const accounts = [
  {
    id: "1",
    name: "Everyday Account",
    number: "123456",
    balance: 5234.56,
    available: 5234.56,
  },
  {
    id: "2",
    name: "Savings Account",
    number: "654321",
    balance: 10234.78,
    available: 10234.78,
  },
];

const transactions = [
  {
    id: "t1",
    date: "2024-06-01",
    description: "Coffee Shop",
    amount: -4.5,
    balance: 5230.06,
  },
  {
    id: "t2",
    date: "2024-05-30",
    description: "Salary",
    amount: 2500.0,
    balance: 5234.56,
  },
  {
    id: "t3",
    date: "2024-05-28",
    description: "Electricity Bill",
    amount: -120.75,
    balance: 2734.56,
  },
];

export default function BendigoBankDashboard() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-gray-900">
      {/* Header */}
      <header className="bg-[#003366] text-white p-4 flex items-center justify-between">
        <div className="text-xl font-bold">Bendigo Bank</div>
        <nav className="space-x-6">
          <a href="#" className="hover:underline">
            Accounts
          </a>
          <a href="#" className="hover:underline">
            Payments
          </a>
          <a href="#" className="hover:underline">
            Transfers
          </a>
          <a href="#" className="hover:underline">
            Statements
          </a>
          <a href="#" className="hover:underline">
            Help
          </a>
        </nav>
        <div className="flex items-center space-x-4">
          <button className="bg-[#0055a5] px-3 py-1 rounded hover:bg-[#0073e6]">Logout</button>
        </div>
      </header>

      {/* Main content container */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Welcome and summary */}
        <section className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Welcome, John Doe</h1>
          <p className="text-gray-700">Here are your account details and recent transactions.</p>
        </section>

        {/* Accounts overview */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded shadow p-6 border border-gray-200"
            >
              <h2 className="text-xl font-semibold mb-1">{account.name}</h2>
              <p className="text-sm text-gray-600 mb-2">Account Number: {account.number}</p>
              <p className="text-2xl font-bold">
                ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500">Available Balance</p>
            </div>
          ))}
        </section>

        {/* Recent transactions */}
        <section className="bg-white rounded shadow p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-sm text-gray-700">{tx.date}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{tx.description}</td>
                  <td
                    className={`py-2 px-3 text-sm font-semibold ${
                      tx.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    ${tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#003366] text-white p-4 text-center text-sm">
        &copy; 2024 Bendigo Bank. All rights reserved.
      </footer>
    </div>
  );
}
