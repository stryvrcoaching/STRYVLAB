import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InfoModal from '@/components/nutrition/studio/InfoModal'

describe('InfoModal', () => {
  it('renders modal with title and description when open', () => {
    render(
      <InfoModal
        isOpen={true}
        title="Injecter les macros calculées"
        description="Cette action va remplacer les calories..."
        example="Si vous injectez dans 'Jour entraînement'..."
        whenToUse="Utilisez ce bouton après avoir ajusté..."
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText('Injecter les macros calculées')).toBeInTheDocument()
    expect(screen.getByText(/Cette action va remplacer/)).toBeInTheDocument()
  })

  it('closes modal when backdrop is clicked', async () => {
    const onClose = jest.fn()
    const { container } = render(
      <InfoModal
        isOpen={true}
        title="Test"
        description="Desc"
        example="Ex"
        whenToUse="When"
        onClose={onClose}
      />
    )
    const backdrop = container.querySelector('[data-testid="modal-backdrop"]')
    await userEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <InfoModal
        isOpen={false}
        title="Test"
        description="Desc"
        example="Ex"
        whenToUse="When"
        onClose={jest.fn()}
      />
    )
    expect(container.firstChild).toBeEmptyDOMElement()
  })
})
