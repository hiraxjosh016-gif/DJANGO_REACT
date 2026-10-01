import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/tasks/'

async function request(path = '', options = {}) {
	const response = await fetch(`${API_URL}${path}`, {
		...options,
		headers: {
			Accept: 'application/json',
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...options.headers,
		},
	})

	if (response.status === 204) return null

	const payload = await response.json().catch(() => null)
	if (!response.ok) {
		const detail = payload?.detail ?? Object.values(payload ?? {}).flat().join(' ')
		throw new Error(detail || `Request failed (${response.status})`)
	}
	return payload
}

const filters = [
	{ id: 'all', label: 'All' },
	{ id: 'open', label: 'To do' },
	{ id: 'done', label: 'Completed' },
]

function App() {
	const [tasks, setTasks] = useState([])
	const [title, setTitle] = useState('')
	const [filter, setFilter] = useState('all')
	const [loading, setLoading] = useState(true)
	const [apiState, setApiState] = useState('connecting')
	const [saving, setSaving] = useState(false)
	const [busyTask, setBusyTask] = useState(null)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		request()
			.then((data) => {
				if (active) {
					setTasks(data)
					setApiState('online')
				}
			})
			.catch((requestError) => {
				if (active) {
					setApiState('offline')
					setError(requestError.message)
				}
			})
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [])

	const completedCount = tasks.filter((task) => task.done).length
	const openCount = tasks.length - completedCount
	const visibleTasks = tasks.filter((task) => {
		if (filter === 'open') return !task.done
		if (filter === 'done') return task.done
		return true
	})

	async function addTask(event) {
		event.preventDefault()
		const cleanTitle = title.trim()
		if (!cleanTitle) return

		setSaving(true)
		setError('')
		try {
			const task = await request('', {
				method: 'POST',
				body: JSON.stringify({ title: cleanTitle, done: false }),
			})
			setTasks((current) => [task, ...current])
			setTitle('')
			setFilter('all')
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setSaving(false)
		}
	}

	async function toggleTask(task) {
		setBusyTask(task.id)
		setError('')
		try {
			const updatedTask = await request(`${task.id}/`, {
				method: 'PATCH',
				body: JSON.stringify({ done: !task.done }),
			})
			setTasks((current) => current.map((item) => item.id === task.id ? updatedTask : item))
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusyTask(null)
		}
	}

	async function deleteTask(task) {
		setBusyTask(task.id)
		setError('')
		try {
			await request(`${task.id}/`, { method: 'DELETE' })
			setTasks((current) => current.filter((item) => item.id !== task.id))
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusyTask(null)
		}
	}

	return (
		<main className="app-shell">
			<header className="topbar">
				<a className="brand" href="/" aria-label="Daymark home">
					<span className="brand-icon" aria-hidden="true">d</span>
					<span>daymark</span>
				</a>
				<div className={`connection connection-${apiState}`}>
					<span className="connection-dot" />
					{apiState === 'connecting' ? 'Connecting' : apiState === 'online' ? 'Django connected' : 'API unavailable'}
				</div>
			</header>

			<section className="workspace" aria-labelledby="page-title">
				<div className="intro">
					<div className="eyebrow"><span /> PERSONAL WORKSPACE</div>
					<h1 id="page-title">Your day,<br /><em>in order.</em></h1>
					<p className="date-note">A little clarity goes a long way.</p>
				</div>

				<div className="overview" aria-label="Task summary">
					<div className="overview-total">
						<span className="overview-number">{tasks.length.toString().padStart(2, '0')}</span>
						<span className="overview-label">TOTAL<br />TASKS</span>
					</div>
					<div className="overview-stat"><span>{openCount}</span><small>To do</small></div>
					<div className="overview-stat"><span>{completedCount}</span><small>Completed</small></div>
					<div className="overview-mark" aria-hidden="true">*</div>
				</div>

				<form className="new-task" onSubmit={addTask}>
					<label className="sr-only" htmlFor="new-task-title">New task</label>
					<span className="input-plus" aria-hidden="true">+</span>
					<input
						id="new-task-title"
						type="text"
						maxLength={50}
						placeholder="Add something to your list..."
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						disabled={saving || apiState === 'offline'}
					/>
					<button className="add-button" type="submit" disabled={saving || !title.trim() || apiState === 'offline'}>
						{saving ? 'Adding...' : 'Add task'} <span aria-hidden="true">+</span>
					</button>
				</form>

				<section className="task-section" aria-labelledby="list-title">
					<div className="list-heading">
						<div className="list-title-wrap">
							<span className="list-kicker">THE LIST</span>
							<h2 id="list-title">Things to do <span>{visibleTasks.length}</span></h2>
						</div>
						<div className="filter-tabs" role="group" aria-label="Filter tasks">
							{filters.map((item) => (
								<button
									className={filter === item.id ? 'filter-active' : ''}
									key={item.id}
									type="button"
									aria-pressed={filter === item.id}
									onClick={() => setFilter(item.id)}
								>
									{item.label}
								</button>
							))}
						</div>
					</div>

					{error && <p className="error-message" role="alert">{error}</p>}

					<div className="task-list" aria-live="polite">
						{loading ? (
							<div className="empty-state"><span className="loading-mark" />Loading your tasks</div>
						) : visibleTasks.length ? visibleTasks.map((task) => (
							<article className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}>
								<button
									className="task-check"
									type="button"
									aria-label={task.done ? `Mark ${task.title} as to do` : `Complete ${task.title}`}
									aria-pressed={task.done}
									disabled={busyTask === task.id}
									onClick={() => toggleTask(task)}
								>
									{task.done && <span aria-hidden="true">✓</span>}
								</button>
								<span className="task-title">{task.title}</span>
								<span className="task-state">{task.done ? 'DONE' : 'OPEN'}</span>
								<button
									className="delete-button"
									type="button"
									aria-label={`Delete ${task.title}`}
									disabled={busyTask === task.id}
									onClick={() => deleteTask(task)}
								>
									<span aria-hidden="true">x</span>
								</button>
							</article>
						)) : (
							<div className="empty-state">
								<span className="empty-mark" aria-hidden="true">{filter === 'done' ? 'OK' : '--'}</span>
								<span>{filter === 'done' ? 'Nothing completed yet.' : filter === 'open' ? 'You are all caught up.' : 'Your list is ready for its first task.'}</span>
							</div>
						)}
					</div>

					<footer className="list-footer">
						<span>{openCount === 0 ? 'All clear.' : `${openCount} ${openCount === 1 ? 'task' : 'tasks'} left to do`}</span>
						<span className="footer-spark" aria-hidden="true">*</span>
					</footer>
				</section>
			</section>
			<footer className="page-footer"><span>DAYMARK</span><span>Small steps, steady progress. Brick by Brick.</span></footer>
		</main>
	)
}

export default App