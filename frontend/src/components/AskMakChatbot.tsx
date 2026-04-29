import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const QUICK_PILLS = [
  'Suggest some makeup options',
  'Best skincare routine for me',
  'How to style up for a date?',
  'Top beauty trends right now',
  'Tips for glowing skin',
];

export default function AskMakChatbot({ tabBarHeight = 70 }: { tabBarHeight?: number }) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', text: "Hi! I'm MAK, your beauty assistant. Ask me anything about makeup, skincare, or styling!", isUser: false, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Bounce animation for FAB
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    if (!isOpen) bounce.start();
    return () => bounce.stop();
  }, [isOpen]);

  const toggleChat = () => {
    if (isOpen) {
      Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: Date.now().toString(), text, isUser: true, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    Keyboard.dismiss();

    try {
      const res = await api.chatWithMak(text, sessionId);
      if (res.session_id) setSessionId(res.session_id);
      const botMsg: Message = { id: (Date.now() + 1).toString(), text: res.response, isUser: false, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), text: "Sorry we are experiencing issues, please try again in some time.", isUser: false, timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgRow, item.isUser && styles.msgRowUser]}>
      {!item.isUser && (
        <View style={[styles.botAvatar, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
      )}
      <View style={[styles.msgBubble, item.isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }]}>
        <Text style={[styles.msgText, { color: item.isUser ? '#FFF' : colors.text }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <Animated.View style={[styles.chatWindow, { backgroundColor: colors.background, borderColor: colors.border, transform: [{ scale: scaleAnim }] }]}>
          {/* Header */}
          <View style={[styles.chatHeader, { backgroundColor: colors.primary }]}>
            <View style={styles.chatHeaderLeft}>
              <View style={styles.chatHeaderAvatar}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>Ask MAK</Text>
                <Text style={styles.chatHeaderSub}>Your Beauty Assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggleChat} style={styles.chatCloseBtn}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <KeyboardAvoidingView style={styles.chatBody} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.msgList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {sending && (
              <View style={styles.typingRow}>
                <View style={[styles.botAvatar, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                </View>
                <View style={[styles.typingBubble, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.typingText, { color: colors.textSecondary }]}>MAK is typing...</Text>
                </View>
              </View>
            )}

            {/* Quick Pills - show when only welcome message */}
            {messages.length <= 1 && !sending && (
              <View style={styles.pillsContainer}>
                <Text style={[styles.pillsTitle, { color: colors.textSecondary }]}>Try asking:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
                  {QUICK_PILLS.map((pill, i) => (
                    <TouchableOpacity key={i} style={[styles.pill, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]} onPress={() => { setInput(pill); }}>
                      <Text style={[styles.pillText, { color: colors.primary }]}>{pill}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input */}
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
              <TextInput
                style={[styles.chatInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Ask about beauty & makeup..."
                placeholderTextColor={colors.textTertiary}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.borderLight }]} onPress={sendMessage} disabled={!input.trim() || sending}>
                <Ionicons name="send" size={18} color={input.trim() ? '#FFF' : colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {/* FAB Button — positioned ABOVE the tab bar so it doesn't overlap navigation */}
      <Animated.View style={[styles.fabContainer, { bottom: tabBarHeight + 16, transform: [{ scale: isOpen ? 1 : bounceAnim }] }]}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={toggleChat} activeOpacity={0.8}>
          {isOpen ? (
            <Ionicons name="close" size={24} color="#FFF" />
          ) : (
            <View style={styles.fabInner}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
              <Text style={styles.fabText}>Ask MAK</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // FAB
  fabContainer: { position: 'absolute', right: 16, alignItems: 'flex-end', zIndex: 998 },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  fabInner: { alignItems: 'center', gap: 1 },
  fabText: { color: '#FFF', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  // Chat Window
  chatWindow: { position: 'absolute', bottom: 155, right: 16, left: 16, height: 440, borderRadius: 20, borderWidth: 1, overflow: 'hidden', zIndex: 999, elevation: 10 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatHeaderAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  chatHeaderTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  chatHeaderSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  chatCloseBtn: { padding: 4 },
  // Body
  chatBody: { flex: 1 },
  msgList: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },
  botAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  msgBubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgText: { fontSize: 13, lineHeight: 19 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  typingText: { fontSize: 12 },
  // Input
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, gap: 8 },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  // Pills
  pillsContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  pillsTitle: { fontSize: 11, marginBottom: 8 },
  pillsScroll: { gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '500' },
});
