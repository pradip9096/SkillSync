import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpertCard from '../ExpertCard';
import * as AuthContext from '../../context/AuthContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('ExpertCard Component', () => {
  const mockExpert = {
    _id: '123',
    name: 'Dr. Jane Smith',
    category: 'Technology',
    description: 'Expert in React.',
    rating: 4.8,
    experience: 10,
    hourlyRate: 1500,
    profileImage: ''
  };

  it('should render expert details correctly', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'User' } });
    render(
      <MemoryRouter>
        <ExpertCard expert={mockExpert} index={0} />
      </MemoryRouter>
    );
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Expert in React.')).toBeInTheDocument();
    expect(screen.getByText('10 yrs exp')).toBeInTheDocument();
    expect(screen.getByText('₹1500/hr')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('View Profile & Book')).toBeInTheDocument();
  });

  it('should change button text for Expert role', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'Expert' } });
    render(
      <MemoryRouter>
        <ExpertCard expert={mockExpert} index={0} />
      </MemoryRouter>
    );
    expect(screen.getByText('View Profile')).toBeInTheDocument();
  });
});
