from unittest.mock import Mock
from forta_agent import FindingSeverity, FindingType, create_transaction_event, create_alert_event
from agent import handle_transaction, handle_alert, ERC20_TRANSFER_EVENT, TETHER_ADDRESS, TETHER_DECIMALS

mock_tx_event = create_transaction_event({})
mock_alert_event = create_alert_event({"alert": {"name": "FORTA-1"}})
mock_tx_event.filter_log = Mock()


class TestHighTetherTransferAgent:
    def test_returns_empty_findings_if_no_tether_transfers(self):
        mock_tx_event.filter_log.return_value = []

        findings = handle_transaction(mock_tx_event)

        assert len(findings) == 0
        mock_tx_event.filter_log.assert_called_once_with(
            ERC20_TRANSFER_EVENT, TETHER_ADDRESS)

    def test_returns_finding_if_tether_transfer_over_10k(self):
        mock_tx_event.filter_log.reset_mock()
        amount = 20000
        mock_transfer_event = {
            'args': {'value': amount * 10**TETHER_DECIMALS, 'from': '0x123', 'to': '0xabc'}}
        mock_tx_event.filter_log.return_value = [mock_transfer_event]

        findings = handle_transaction(mock_tx_event)

        assert len(findings) == 1
        mock_tx_event.filter_log.assert_called_once_with(
            ERC20_TRANSFER_EVENT, TETHER_ADDRESS)
        finding = findings[0]
        assert finding.name == "High Tether Transfer"
        assert finding.description == f'High amount of USDT transferred: {mock_transfer_event["args"]["value"] / 10**TETHER_DECIMALS}'
        assert finding.alert_id == "FORTA-1"
        assert finding.severity == FindingSeverity.Low
        assert finding.type == FindingType.Info

    def test_returns_empty_findings_if_no_erc20_alerts(self):
        findings = handle_alert(create_alert_event({}))

        assert len(findings) == 0

    def test_returns_finding_if_forta_transfer_alert(self):
        findings = handle_alert(mock_alert_event)

        assert len(findings) == 1
        finding = findings[0]
        assert finding.name == "High ERC20 Transfer"
        assert finding.description == f'High amount of ERC20 transferred'
        assert finding.alert_id == "FORTA-2"
        assert finding.severity == FindingSeverity.Low
        assert finding.type == FindingType.Info
