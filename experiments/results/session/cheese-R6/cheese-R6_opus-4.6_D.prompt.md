# cheese-R6_opus-4.6_D

<!-- meta
experiment_id: cheese-R6
model_name: opus-4.6
model_id: claude-opus-4-6
group: D
prompt_sha256: f851b88e3298da1cdafb3c80d87f377716a82e652ceccb6af03674521e4309fe
code_sha256: 85f9fa277984ad081386a89ad3b10d24dbfb244be88eb1362f1fd8e6d204efb2
repo: python-hyper/h2
commit: latest-master
file: src/h2/connection.py
lines: 1-418
-->

## 프롬프트

Analyze the cognitive complexity of the following code.
Identify functions that are too complex for a developer (or an LLM) to reason about safely.
For each function, estimate its cyclomatic complexity and explain what makes it hard to understand.

Use the following checklist:
- C1: Cyclomatic complexity per function — estimate the number and rate A(1-5) B(6-10) C(11-15) D(16-25) F(26+). Flag B or higher.
- C2: Nesting depth — flag functions with nesting > 3 levels.
- C3: Single Responsibility — does each function do exactly one thing? Flag functions with multiple responsibilities.
- C4: Code placement — is each piece of logic in the appropriate function? Flag misplaced logic that should be extracted or moved.

For each rule (C1-C4), provide:
1. Finding (specific function name and location)
2. Rating: pass / warning / fail
3. Refactoring recommendation if needed

After completing the checklist, perform an additional free-form analysis:
identify any complexity issues NOT covered by C1-C4 above.

```python
    def __init__(self) -> None:
        self.state = ConnectionState.IDLE

    def __init__(self, config: H2Configuration | None = None) -> None:
        self.state_machine = H2ConnectionStateMachine()
        self.streams: dict[int, H2Stream] = {}
        self.highest_inbound_stream_id = 0
        self.highest_outbound_stream_id = 0
        self.encoder = Encoder()
        self.decoder = Decoder()

        # This won't always actually do anything: for versions of HPACK older
        # than 2.3.0 it does nothing. However, we have to try!
        self.decoder.max_header_list_size = self.DEFAULT_MAX_HEADER_LIST_SIZE

        #: The configuration for this HTTP/2 connection object.
        #:
        #: .. versionadded:: 2.5.0
        self.config = config or H2Configuration(client_side=True)

        # Objects that store settings, including defaults.
        #
        # We set the MAX_CONCURRENT_STREAMS value to 100 because its default is
        # unbounded, and that's a dangerous default because it allows
        # essentially unbounded resources to be allocated regardless of how
        # they will be used. 100 should be suitable for the average
        # application. This default obviously does not apply to the remote
        # peer's settings: the remote peer controls them!
        #
        # We also set MAX_HEADER_LIST_SIZE to a reasonable value. This is to
        # advertise our defence against CVE-2016-6581. However, not all
        # versions of HPACK will let us do it. That's ok: we should at least
        # suggest that we're not vulnerable.
        self.local_settings = Settings(
            client=self.config.client_side,
            initial_values={
                SettingCodes.MAX_CONCURRENT_STREAMS: 100,
                SettingCodes.MAX_HEADER_LIST_SIZE:
                    self.DEFAULT_MAX_HEADER_LIST_SIZE,
            },
        )
        self.remote_settings = Settings(client=not self.config.client_side)

        # The current value of the connection flow control windows on the
        # connection.
        self.outbound_flow_control_window = (
            self.remote_settings.initial_window_size
        )

        #: The maximum size of a frame that can be emitted by this peer, in
        #: bytes.
        self.max_outbound_frame_size = self.remote_settings.max_frame_size

        #: The maximum size of a frame that can be received by this peer, in
        #: bytes.
        self.max_inbound_frame_size = self.local_settings.max_frame_size

        # Buffer for incoming data.
        self.incoming_buffer = FrameBuffer(server=not self.config.client_side)

        # A private variable to store a sequence of received header frames
        # until completion.
        self._header_frames: list[Frame] = []

        # Data that needs to be sent.
        self._data_to_send = bytearray()

        # Keeps track of how streams are closed.
        # Used to ensure that we don't blow up in the face of frames that were
        # in flight when a RST_STREAM was sent.
        # Also used to determine whether we should consider a frame received
        # while a stream is closed as either a stream error or a connection
        # error.
        self._closed_streams: dict[int, StreamClosedBy | None] = SizeLimitDict(
            size_limit=self.MAX_CLOSED_STREAMS,
        )

        # The flow control window manager for the connection.
        self._inbound_flow_control_window_manager = WindowManager(
            max_window_size=self.local_settings.initial_window_size,
        )

        # When in doubt use dict-dispatch.
        self._frame_dispatch_table: dict[type[Frame], Callable] = {  # type: ignore
            HeadersFrame: self._receive_headers_frame,
            PushPromiseFrame: self._receive_push_promise_frame,
            SettingsFrame: self._receive_settings_frame,
            DataFrame: self._receive_data_frame,
            WindowUpdateFrame: self._receive_window_update_frame,
            PingFrame: self._receive_ping_frame,
            RstStreamFrame: self._receive_rst_stream_frame,
            PriorityFrame: self._receive_priority_frame,
            GoAwayFrame: self._receive_goaway_frame,
            ContinuationFrame: self._receive_naked_continuation,
            AltSvcFrame: self._receive_alt_svc_frame,
            ExtensionFrame: self._receive_unknown_frame,
        }

    def send_headers(self,
                     stream_id: int,
                     headers: Iterable[HeaderWeaklyTyped],
                     end_stream: bool = False,
                     priority_weight: int | None = None,
                     priority_depends_on: int | None = None,
                     priority_exclusive: bool | None = None) -> None:
        """
        Send headers on a given stream.

        This function can be used to send request or response headers: the kind
        that are sent depends on whether this connection has been opened as a
        client or server connection, and whether the stream was opened by the
        remote peer or not.

        If this is a client connection, calling ``send_headers`` will send the
        headers as a request. It will also implicitly open the stream being
        used. If this is a client connection and ``send_headers`` has *already*
        been called, this will send trailers instead.

        If this is a server connection, calling ``send_headers`` will send the
        headers as a response. It is a protocol error for a server to open a
        stream by sending headers. If this is a server connection and
        ``send_headers`` has *already* been called, this will send trailers
        instead.

        When acting as a server, you may call ``send_headers`` any number of
        times allowed by the following rules, in this order:

        - zero or more times with ``(':status', '1XX')`` (where ``1XX`` is a
          placeholder for any 100-level status code).
        - once with any other status header.
        - zero or one time for trailers.

        That is, you are allowed to send as many informational responses as you
        like, followed by one complete response and zero or one HTTP trailer
        blocks.

        Clients may send one or two header blocks: one request block, and
        optionally one trailer block.

        If it is important to send HPACK "never indexed" header fields (as
        defined in `RFC 7451 Section 7.1.3
        <https://tools.ietf.org/html/rfc7541#section-7.1.3>`_), the user may
        instead provide headers using the HPACK library's :class:`HeaderTuple
        <hpack:hpack.HeaderTuple>` and :class:`NeverIndexedHeaderTuple
        <hpack:hpack.NeverIndexedHeaderTuple>` objects.

        This method also allows users to prioritize the stream immediately,
        by sending priority information on the HEADERS frame directly. To do
        this, any one of ``priority_weight``, ``priority_depends_on``, or
        ``priority_exclusive`` must be set to a value that is not ``None``. For
        more information on the priority fields, see :meth:`prioritize
        <h2.connection.H2Connection.prioritize>`.

        .. warning:: In HTTP/2, it is mandatory that all the HTTP/2 special
            headers (that is, ones whose header keys begin with ``:``) appear
            at the start of the header block, before any normal headers.

        .. versionchanged:: 2.3.0
           Added support for using :class:`HeaderTuple
           <hpack:hpack.HeaderTuple>` objects to store headers.

        .. versionchanged:: 2.4.0
           Added the ability to provide priority keyword arguments:
           ``priority_weight``, ``priority_depends_on``, and
           ``priority_exclusive``.

        :param stream_id: The stream ID to send the headers on. If this stream
            does not currently exist, it will be created.
        :type stream_id: ``int``

        :param headers: The request/response headers to send.
        :type headers: An iterable of two tuples of bytestrings or
            :class:`HeaderTuple <hpack:hpack.HeaderTuple>` objects.

        :param end_stream: Whether this headers frame should end the stream
            immediately (that is, whether no more data will be sent after this
            frame). Defaults to ``False``.
        :type end_stream: ``bool``

        :param priority_weight: Sets the priority weight of the stream. See
            :meth:`prioritize <h2.connection.H2Connection.prioritize>` for more
            about how this field works. Defaults to ``None``, which means that
            no priority information will be sent.
        :type priority_weight: ``int`` or ``None``

        :param priority_depends_on: Sets which stream this one depends on for
            priority purposes. See :meth:`prioritize
            <h2.connection.H2Connection.prioritize>` for more about how this
            field works. Defaults to ``None``, which means that no priority
            information will be sent.
        :type priority_depends_on: ``int`` or ``None``

        :param priority_exclusive: Sets whether this stream exclusively depends
            on the stream given in ``priority_depends_on`` for priority
            purposes. See :meth:`prioritize
            <h2.connection.H2Connection.prioritize>` for more about how this
            field works. Defaults to ``None``, which means that no priority
            information will be sent.
        :type priority_depends_on: ``bool`` or ``None``

        :returns: Nothing
        """
        self.config.logger.debug(
            "Send headers on stream ID %d", stream_id,
        )

        # Check we can open the stream.
        if stream_id not in self.streams:
            max_open_streams = self.remote_settings.max_concurrent_streams
            value = self.open_outbound_streams # take a copy due to the property accessor having side affects
            if (value + 1) > max_open_streams:
                msg = f"Max outbound streams is {max_open_streams}, {value} open"
                raise TooManyStreamsError(msg)

        self.state_machine.process_input(ConnectionInputs.SEND_HEADERS)
        stream = self._get_or_create_stream(
            stream_id, AllowedStreamIDs(self.config.client_side),
        )

        frames: list[Frame] = []
        frames.extend(stream.send_headers(
            headers, self.encoder, end_stream,
        ))

        # We may need to send priority information.
        priority_present = (
            (priority_weight is not None) or
            (priority_depends_on is not None) or
            (priority_exclusive is not None)
        )

        if priority_present:
            if not self.config.client_side:
                msg = "Servers SHOULD NOT prioritize streams."
                raise RFC1122Error(msg)

            headers_frame = frames[0]
            assert isinstance(headers_frame, HeadersFrame)

            headers_frame.flags.add("PRIORITY")
            frames[0] = _add_frame_priority(
                headers_frame,
                priority_weight,
                priority_depends_on,
                priority_exclusive,
            )

        self._prepare_for_sending(frames)

    def send_data(self,
                  stream_id: int,
                  data: bytes | memoryview,
                  end_stream: bool = False,
                  pad_length: Any = None) -> None:
        """
        Send data on a given stream.

        This method does no breaking up of data: if the data is larger than the
        value returned by :meth:`local_flow_control_window
        <h2.connection.H2Connection.local_flow_control_window>` for this stream
        then a :class:`FlowControlError <h2.exceptions.FlowControlError>` will
        be raised. If the data is larger than :data:`max_outbound_frame_size
        <h2.connection.H2Connection.max_outbound_frame_size>` then a
        :class:`FrameTooLargeError <h2.exceptions.FrameTooLargeError>` will be
        raised.

        h2 does this to avoid buffering the data internally. If the user
        has more data to send than h2 will allow, consider breaking it up
        and buffering it externally.

        :param stream_id: The ID of the stream on which to send the data.
        :type stream_id: ``int``
        :param data: The data to send on the stream.
        :type data: ``bytes``
        :param end_stream: (optional) Whether this is the last data to be sent
            on the stream. Defaults to ``False``.
        :type end_stream: ``bool``
        :param pad_length: (optional) Length of the padding to apply to the
            data frame. Defaults to ``None`` for no use of padding. Note that
            a value of ``0`` results in padding of length ``0``
            (with the "padding" flag set on the frame).

            .. versionadded:: 2.6.0

        :type pad_length: ``int``
        :returns: Nothing
        """
        self.config.logger.debug(
            "Send data on stream ID %d with len %d", stream_id, len(data),
        )
        frame_size = len(data)
        if pad_length is not None:
            if not isinstance(pad_length, int):
                msg = "pad_length must be an int"
                raise TypeError(msg)
            if pad_length < 0 or pad_length > 255:
                msg = "pad_length must be within range: [0, 255]"
                raise ValueError(msg)
            # Account for padding bytes plus the 1-byte padding length field.
            frame_size += pad_length + 1
        self.config.logger.debug(
            "Frame size on stream ID %d is %d", stream_id, frame_size,
        )

        if frame_size > self.local_flow_control_window(stream_id):
            msg = f"Cannot send {frame_size} bytes, flow control window is {self.local_flow_control_window(stream_id)}"
            raise FlowControlError(msg)
        if frame_size > self.max_outbound_frame_size:
            msg = f"Cannot send frame size {frame_size}, max frame size is {self.max_outbound_frame_size}"
            raise FrameTooLargeError(msg)

        self.state_machine.process_input(ConnectionInputs.SEND_DATA)
        frames = self.streams[stream_id].send_data(
            data, end_stream, pad_length=pad_length,
        )

        self._prepare_for_sending(frames)

        self.outbound_flow_control_window -= frame_size
        self.config.logger.debug(
            "Outbound flow control window size is %d",
            self.outbound_flow_control_window,
        )
        assert self.outbound_flow_control_window >= 0

    def acknowledge_received_data(self, acknowledged_size: int, stream_id: int) -> None:
        """
        Inform the :class:`H2Connection <h2.connection.H2Connection>` that a
        certain number of flow-controlled bytes have been processed, and that
        the space should be handed back to the remote peer at an opportune
        time.

        .. versionadded:: 2.5.0

        :param acknowledged_size: The total *flow-controlled size* of the data
            that has been processed. Note that this must include the amount of
            padding that was sent with that data.
        :type acknowledged_size: ``int``
        :param stream_id: The ID of the stream on which this data was received.
        :type stream_id: ``int``
        :returns: Nothing
        :rtype: ``None``
        """
        self.config.logger.debug(
            "Ack received data on stream ID %d with size %d",
            stream_id, acknowledged_size,
        )
        if stream_id <= 0:
            msg = f"Stream ID {stream_id} is not valid for acknowledge_received_data"
            raise ValueError(msg)
        if acknowledged_size < 0:
            msg = "Cannot acknowledge negative data"
            raise ValueError(msg)

        frames: list[Frame] = []

        conn_manager = self._inbound_flow_control_window_manager
        conn_increment = conn_manager.process_bytes(acknowledged_size)
        if conn_increment:
            f = WindowUpdateFrame(0)
            f.window_increment = conn_increment
            frames.append(f)

        try:
            stream = self._get_stream_by_id(stream_id)
        except StreamClosedError:
            # The stream is already gone. We're not worried about incrementing
            # the window in this case.
            pass
        else:
            # No point incrementing the windows of closed streams.
            if stream.open:
                frames.extend(
                    stream.acknowledge_received_data(acknowledged_size),
                )

        self._prepare_for_sending(frames)

    def _receive_headers_frame(self, frame: HeadersFrame) -> tuple[list[Frame], list[Event]]:
        """
        Receive a headers frame on the connection.
        """
        # If necessary, check we can open the stream. Also validate that the
        # stream ID is valid.
        if frame.stream_id not in self.streams:
            max_open_streams = self.local_settings.max_concurrent_streams
            value = self.open_inbound_streams # take a copy due to the property accessor having side affects
            if (value + 1) > max_open_streams:
                msg = f"Max inbound streams is {max_open_streams}, {value} open"
                raise TooManyStreamsError(msg)

        # Let's decode the headers. We handle headers as bytes internally up
        # until we hang them off the event, at which point we may optionally
        # convert them to unicode.
        headers = _decode_headers(self.decoder, frame.data)

        events = self.state_machine.process_input(
            ConnectionInputs.RECV_HEADERS,
        )
        stream = self._get_or_create_stream(
            frame.stream_id, AllowedStreamIDs(not self.config.client_side),
        )
        frames, stream_events = stream.receive_headers(
            headers,
            "END_STREAM" in frame.flags,
            self.config.header_encoding,
        )

        if "PRIORITY" in frame.flags:
            p_frames, p_events = self._receive_priority_frame(frame)
            expected_frame_types = (RequestReceived, ResponseReceived, TrailersReceived, InformationalResponseReceived)
            assert isinstance(stream_events[0], expected_frame_types)
            assert isinstance(p_events[0], PriorityUpdated)
            stream_events[0].priority_updated = p_events[0]
            stream_events.extend(p_events)
            assert not p_frames

        return frames, events + stream_events

```

---

## Claude 응답

<!-- Claude가 여기에 응답을 작성 -->
